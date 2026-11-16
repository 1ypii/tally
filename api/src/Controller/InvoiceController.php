<?php

namespace App\Controller;

use App\Dto\InvoiceInput;
use App\Dto\PaymentInput;
use App\Entity\Client;
use App\Entity\Income;
use App\Entity\Invoice;
use App\Entity\InvoiceStatus;
use App\Entity\Payment;
use App\Entity\User;
use App\Pdf;
use App\Recurring;
use App\Repository\InvoiceRepository;
use App\Website;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/invoices')]
final class InvoiceController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private InvoiceRepository $invoices,
        private Recurring $recurring,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function list(#[CurrentUser] User $user): JsonResponse
    {
        $this->recurring->run($user);
        $today = new \DateTimeImmutable('today');
        $rows = array_map(fn (Invoice $i) => $this->toJson($i, $today), $this->invoices->listFor($user));

        return $this->json($rows);
    }

    #[Route('/summary', methods: ['GET'])]
    public function summary(#[CurrentUser] User $user): JsonResponse
    {
        $this->recurring->run($user);
        $today = new \DateTimeImmutable('today');
        $monthAgo = $today->modify('-30 days');
        $firstMonth = $today->modify('first day of this month')->modify('-5 months');

        $months = [];
        for ($i = 0; $i < 6; $i++) {
            $months[] = $firstMonth->modify("+$i months")->format('Y-m');
        }

        $drafts = 0;
        $byCurrency = [];
        $bucket = fn () => ['outstanding' => 0, 'overdue' => 0, 'overdueCount' => 0, 'paid30' => 0, 'paidByMonth' => array_fill(0, 6, 0)];

        foreach ($this->invoices->listFor($user) as $inv) {
            if ($inv->isQuote()) {
                continue;
            }
            if ($inv->getStatus() === InvoiceStatus::Draft) {
                $drafts++;
                continue;
            }

            $code = $inv->getCurrency();
            $byCurrency[$code] ??= $bucket();

            if ($inv->getStatus() === InvoiceStatus::Sent) {
                $byCurrency[$code]['outstanding'] += $inv->balance();
                if ($inv->isOverdue($today)) {
                    $byCurrency[$code]['overdue'] += $inv->balance();
                    $byCurrency[$code]['overdueCount']++;
                }
            }

            foreach ($inv->getPayments() as $payment) {
                if ($payment->getPaidOn() >= $monthAgo) {
                    $byCurrency[$code]['paid30'] += $payment->getAmount();
                }
                $slot = array_search($payment->getPaidOn()->format('Y-m'), $months, true);
                if ($slot !== false) {
                    $byCurrency[$code]['paidByMonth'][$slot] += $payment->getAmount();
                }
            }
        }

        foreach ($this->em->getRepository(Income::class)->findBy(['owner' => $user]) as $income) {
            $row = $income->toJson();
            $code = $row['currency'];
            $byCurrency[$code] ??= $bucket();
            if (new \DateTimeImmutable($row['receivedOn']) >= $monthAgo) {
                $byCurrency[$code]['paid30'] += $row['amount'];
            }
            $slot = array_search(substr($row['receivedOn'], 0, 7), $months, true);
            if ($slot !== false) {
                $byCurrency[$code]['paidByMonth'][$slot] += $row['amount'];
            }
        }

        return $this->json(['drafts' => $drafts, 'months' => $months, 'currencies' => (object) $byCurrency]);
    }

    #[Route('/{id}', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(#[CurrentUser] User $user, int $id): JsonResponse
    {
        return $this->full($this->find($user, $id));
    }

    #[Route('', methods: ['POST'])]
    public function create(#[CurrentUser] User $user, #[MapRequestPayload] InvoiceInput $input): JsonResponse
    {
        $client = $this->client($user, $input->clientId);
        if (!$client) {
            return $this->json(['error' => 'client not found'], 422);
        }

        $inv = $this->fresh($user, $client, $input->kind);
        $this->apply($inv, $client, $input);
        $this->em->persist($inv);
        $this->em->flush();

        return $this->full($inv, 201);
    }

    #[Route('/{id}', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function update(#[CurrentUser] User $user, int $id, #[MapRequestPayload] InvoiceInput $input): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->getStatus() !== InvoiceStatus::Draft) {
            return $this->json(['error' => 'only drafts can be edited'], 409);
        }

        $client = $this->client($user, $input->clientId);
        if (!$client) {
            return $this->json(['error' => 'client not found'], 422);
        }

        $this->apply($inv, $client, $input);
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/pdf', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function pdf(#[CurrentUser] User $user, int $id): Response
    {
        $inv = $this->find($user, $id);

        return new Response(Pdf::render($inv), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.Pdf::filename($inv).'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    #[Route('/{id}/send', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function send(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->getStatus() !== InvoiceStatus::Draft) {
            return $this->json(['error' => 'this was already sent'], 409);
        }

        $inv->markSent(new \DateTimeImmutable());
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/unsend', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function unsend(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->getStatus() !== InvoiceStatus::Sent || $inv->paid() > 0) {
            return $this->json(['error' => 'only sent ones with no payments can go back to draft'], 409);
        }

        $inv->unsend();
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/unpay', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function unpay(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->isQuote() || $inv->getStatus() === InvoiceStatus::Draft || $inv->paid() === 0) {
            return $this->json(['error' => 'this invoice has no payments to remove'], 409);
        }

        $inv->clearPayments();
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/duplicate', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function duplicate(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        $copy = $this->copyOf($user, $inv, $inv->getKind());
        $this->em->persist($copy);
        $this->em->flush();

        return $this->full($copy, 201);
    }

    #[Route('/{id}/convert', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function convert(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $quote = $this->find($user, $id);
        if (!$quote->isQuote() || $quote->getConvertedTo() !== null) {
            return $this->json(['error' => 'only quotes that were not converted yet can become invoices'], 409);
        }
        if ($quote->getStatus() === InvoiceStatus::Declined) {
            return $this->json(['error' => 'this quote was declined'], 409);
        }

        $inv = $this->copyOf($user, $quote, 'invoice');
        $this->em->persist($inv);
        $this->em->flush();

        $quote->setConvertedTo($inv->getId());
        if ($quote->getStatus() !== InvoiceStatus::Accepted) {
            $quote->setQuoteAnswer(true);
        }
        $this->em->flush();

        return $this->full($inv, 201);
    }

    #[Route('/{id}/repeat', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function repeat(#[CurrentUser] User $user, int $id, Request $request): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->isQuote()) {
            return $this->json(['error' => 'quotes cannot repeat'], 409);
        }

        $body = json_decode($request->getContent(), true);
        $every = is_array($body) ? ($body['every'] ?? null) : null;
        if ($every !== null && !in_array($every, Invoice::repeats, true)) {
            return $this->json(['error' => 'pick weekly, monthly, quarterly or yearly'], 422);
        }

        $step = ['weekly' => '+1 week', 'monthly' => '+1 month', 'quarterly' => '+3 months', 'yearly' => '+1 year'][$every] ?? null;
        $inv->setRepeat($every, $step ? $inv->getIssuedOn()->modify($step) : null);
        $this->em->flush();
        $this->recurring->run($user);

        return $this->full($inv);
    }

    #[Route('/{id}/remind', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function remind(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->getStatus() !== InvoiceStatus::Sent) {
            return $this->json(['error' => 'only unpaid sent invoices get reminders'], 409);
        }

        $inv->markReminded(new \DateTimeImmutable());
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/notice', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function dismissNotice(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        $inv->setNotice(null, null, null);
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/share', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function share(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->getStatus() === InvoiceStatus::Draft) {
            return $this->json(['error' => 'send it before sharing it'], 409);
        }

        $inv->newShareToken();
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/share', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function unshare(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        $inv->revokeShareToken();
        $this->em->flush();

        return $this->full($inv);
    }

    #[Route('/{id}/payments', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function pay(#[CurrentUser] User $user, int $id, #[MapRequestPayload] PaymentInput $input): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->isQuote() || $inv->getStatus() !== InvoiceStatus::Sent) {
            return $this->json(['error' => 'payments can only be recorded on sent invoices'], 409);
        }
        if ($input->amount > $inv->balance()) {
            return $this->json(['error' => 'that is more than what is still owed'], 422);
        }

        $paidOn = new \DateTimeImmutable($input->paidOn);
        if ($paidOn > new \DateTimeImmutable('today')) {
            return $this->json(['error' => 'payment date cannot be in the future'], 422);
        }

        $inv->addPayment(new Payment($user, $inv, $input->amount, $paidOn, $input->method, Website::clean($input->note)));
        $inv->setNotice(null, null, null);
        $this->em->flush();

        return $this->full($inv, 201);
    }

    #[Route('/{id}', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $inv = $this->find($user, $id);
        if ($inv->getStatus() !== InvoiceStatus::Draft) {
            return $this->json(['error' => 'only drafts can be deleted'], 409);
        }

        $this->em->remove($inv);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    private function fresh(User $user, Client $client, string $kind): Invoice
    {
        $seq = $this->invoices->nextSeq($user, $kind);

        return new Invoice($user, $client, $kind, $seq, $user->prefixFor($kind).str_pad((string) $seq, 4, '0', STR_PAD_LEFT));
    }

    private function copyOf(User $user, Invoice $source, string $kind): Invoice
    {
        $seq = $this->invoices->nextSeq($user, $kind);
        $today = new \DateTimeImmutable('today');

        return $source->copy($kind, $seq, $user->prefixFor($kind).str_pad((string) $seq, 4, '0', STR_PAD_LEFT), $today, $today->modify('+'.$source->getClient()->getTermsDays().' days'));
    }

    private function find(User $user, int $id): Invoice
    {
        return $this->invoices->findOneBy(['id' => $id, 'owner' => $user]) ?? throw $this->createNotFoundException();
    }

    private function client(User $user, int $id): ?Client
    {
        return $this->em->getRepository(Client::class)->findOneBy(['id' => $id, 'owner' => $user]);
    }

    private function apply(Invoice $inv, Client $client, InvoiceInput $input): void
    {
        $inv->setClient($client);
        $inv->setCurrency($input->currency);
        $inv->setShowSender($input->showSender);
        $inv->setShowLogo($input->showLogo);
        $inv->setDates(new \DateTimeImmutable($input->issuedOn), new \DateTimeImmutable($input->dueOn));
        $inv->setNotes(Website::clean($input->notes));
        $inv->setAdjustments(
            $input->taxRate,
            $input->taxRate > 0 ? Website::clean($input->taxLabel) : null,
            $input->discountValue > 0 ? $input->discountKind : null,
            $input->discountKind === 'percent' ? min($input->discountValue, 10000) : $input->discountValue,
        );

        $lines = [];
        foreach ($input->lines as $line) {
            $lines[] = $line->fixed
                ? [trim($line->description), 100, $line->unitPrice, true]
                : [trim($line->description), (int) round($line->quantity * 100), $line->unitPrice, false];
        }
        $inv->replaceLines($lines);
    }

    private function full(Invoice $inv, int $status = 200): JsonResponse
    {
        return $this->json($this->toJson($inv, new \DateTimeImmutable('today'), true), $status);
    }

    private function toJson(Invoice $inv, \DateTimeImmutable $today, bool $full = false): array
    {
        $client = $inv->getClient();
        $row = [
            'id' => $inv->getId(),
            'kind' => $inv->getKind(),
            'number' => $inv->number(),
            'status' => $inv->isOverdue($today) ? 'overdue' : $inv->getStatus()->value,
            'client' => ['id' => $client->getId(), 'name' => $client->getName(), 'website' => $client->getWebsite()],
            'issuedOn' => $inv->getIssuedOn()->format('Y-m-d'),
            'dueOn' => $inv->getDueOn()->format('Y-m-d'),
            'sentAt' => $inv->getSentAt()?->format(DATE_ATOM),
            'paidAt' => $inv->getPaidAt()?->format(DATE_ATOM),
            'currency' => $inv->getCurrency(),
            'total' => $inv->total(),
            'paid' => $inv->paid(),
            'balance' => $inv->balance(),
            'repeatEvery' => $inv->getRepeatEvery(),
            'viewed' => $inv->views()['first'] !== null,
            'notice' => $inv->notice() !== null,
        ];

        if (!$full) {
            return $row;
        }

        $row['client'] += [
            'email' => $client->getEmail(),
            'location' => $client->getLocation(),
            'taxId' => $client->getTaxId(),
            'phone' => $client->getPhone(),
            'termsDays' => $client->getTermsDays(),
        ];
        $row['notes'] = $inv->getNotes();
        $row['subtotal'] = $inv->subtotal();
        $row['discount'] = $inv->discount();
        $row['discountKind'] = $inv->getDiscountKind();
        $row['discountValue'] = $inv->getDiscountValue();
        $row['tax'] = $inv->tax();
        $row['taxRate'] = $inv->getTaxRate();
        $row['taxLabel'] = $inv->getTaxLabel();
        $row['lines'] = [];
        foreach ($inv->getLines() as $line) {
            $row['lines'][] = [
                'description' => $line->getDescription(),
                'quantity' => $line->getQuantity() / 100,
                'unitPrice' => $line->getUnitPrice(),
                'amount' => $line->amount(),
                'fixed' => $line->isFixed(),
            ];
        }
        $row['payments'] = array_map(fn (Payment $p) => $p->toJson(), $inv->getPayments()->toArray());
        $row['shareToken'] = $inv->getShareToken();
        $row['showSender'] = $inv->showsSender();
        $row['showLogo'] = $inv->showsLogo();
        $row['logo'] = $inv->logoVisible();
        $row['sender'] = $inv->showsSender() ? $inv->getOwner()->profile() : null;
        $row['payLink'] = $inv->getOwner()->getPayLink();
        $row['nextRepeatOn'] = $inv->getNextRepeatOn()?->format('Y-m-d');
        $row['remindedAt'] = $inv->getRemindedAt()?->format(DATE_ATOM);
        $row['views'] = $inv->views();
        $row['notice'] = $inv->notice();
        $row['convertedTo'] = $inv->getConvertedTo();

        return $row;
    }
}
