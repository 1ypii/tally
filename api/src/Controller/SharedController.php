<?php

namespace App\Controller;

use App\Entity\Invoice;
use App\Entity\InvoiceStatus;
use App\Pdf;
use App\Repository\InvoiceRepository;
use App\Website;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/shared/{token}', requirements: ['token' => '[A-Za-z0-9_-]{43}'])]
final class SharedController extends AbstractController
{
    public function __construct(
        private InvoiceRepository $invoices,
        private EntityManagerInterface $em,
        private RateLimiterFactoryInterface $sharedLimiter,
        private RateLimiterFactoryInterface $noticeLimiter,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function show(string $token, Request $request, Security $security): JsonResponse
    {
        if (!$this->allowed($request)) {
            return $this->tooMany();
        }

        $inv = $this->find($token);
        if (!$inv) {
            return $this->gone();
        }

        if ($security->getUser() !== $inv->getOwner()) {
            $inv->recordView(new \DateTimeImmutable());
            $this->em->flush();
        }

        return $this->payload($inv);
    }

    #[Route('/pdf', methods: ['GET'])]
    public function pdf(string $token, Request $request): Response
    {
        if (!$this->allowed($request)) {
            return $this->tooMany();
        }

        $inv = $this->find($token);
        if (!$inv) {
            return $this->gone();
        }

        return new Response(Pdf::render($inv), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.Pdf::filename($inv).'"',
            'Cache-Control' => 'no-store',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }

    #[Route('/logo', methods: ['GET'])]
    public function logo(string $token, Request $request): Response
    {
        if (!$this->allowed($request)) {
            return $this->tooMany();
        }

        $inv = $this->find($token);
        if (!$inv || !$inv->logoVisible()) {
            return $this->gone();
        }

        return UploadController::serve($inv->getOwner()->getLogo(), false);
    }

    #[Route('/notice', methods: ['POST'])]
    public function notice(string $token, Request $request): JsonResponse
    {
        if (!$this->allowed($request) || !$this->noticeLimiter->create(($request->getClientIp() ?? 'unknown').$token)->consume()->isAccepted()) {
            return $this->tooMany();
        }

        $inv = $this->find($token);
        if (!$inv || $inv->isQuote() || $inv->getStatus() !== InvoiceStatus::Sent) {
            return $this->gone();
        }

        $body = json_decode($request->getContent(), true);
        $ref = is_array($body) && is_string($body['reference'] ?? null) ? mb_substr(trim($body['reference']), 0, 120) : '';
        $note = is_array($body) && is_string($body['note'] ?? null) ? mb_substr(trim($body['note']), 0, 300) : '';

        $inv->setNotice(Website::clean($ref), Website::clean($note), new \DateTimeImmutable());
        $this->em->flush();

        return $this->payload($inv);
    }

    #[Route('/answer', methods: ['POST'])]
    public function answer(string $token, Request $request): JsonResponse
    {
        if (!$this->allowed($request) || !$this->noticeLimiter->create(($request->getClientIp() ?? 'unknown').$token)->consume()->isAccepted()) {
            return $this->tooMany();
        }

        $inv = $this->find($token);
        if (!$inv || !$inv->isQuote() || $inv->getStatus() !== InvoiceStatus::Sent) {
            return $this->gone();
        }

        $body = json_decode($request->getContent(), true);
        $accepted = is_array($body) && ($body['accepted'] ?? null) === true;
        $inv->setQuoteAnswer($accepted);
        $this->em->flush();

        return $this->payload($inv);
    }

    private function allowed(Request $request): bool
    {
        return $this->sharedLimiter->create($request->getClientIp() ?? 'unknown')->consume()->isAccepted();
    }

    private function find(string $token): ?Invoice
    {
        $inv = $this->invoices->findOneBy(['shareToken' => $token]);

        return $inv && $inv->getStatus() !== InvoiceStatus::Draft ? $inv : null;
    }

    private function tooMany(): JsonResponse
    {
        return new JsonResponse(['error' => 'too many requests, try again later'], 429);
    }

    private function gone(): JsonResponse
    {
        return new JsonResponse(['error' => 'this link does not work anymore'], 404);
    }

    private function payload(Invoice $inv): JsonResponse
    {
        $client = $inv->getClient();
        $lines = [];
        foreach ($inv->getLines() as $line) {
            $lines[] = [
                'description' => $line->getDescription(),
                'quantity' => $line->getQuantity() / 100,
                'unitPrice' => $line->getUnitPrice(),
                'amount' => $line->amount(),
                'fixed' => $line->isFixed(),
            ];
        }

        $payments = [];
        foreach ($inv->getPayments() as $p) {
            $payments[] = ['paidOn' => $p->getPaidOn()->format('Y-m-d'), 'amount' => $p->getAmount(), 'method' => $p->getMethod()];
        }

        $res = $this->json([
            'kind' => $inv->getKind(),
            'number' => $inv->number(),
            'status' => $inv->isOverdue(new \DateTimeImmutable('today')) ? 'overdue' : $inv->getStatus()->value,
            'client' => [
                'name' => $client->getName(),
                'website' => $client->getWebsite(),
                'location' => $client->getLocation(),
                'taxId' => $client->getTaxId(),
            ],
            'sender' => $inv->showsSender() ? $inv->getOwner()->profile() : null,
            'logo' => $inv->logoVisible(),
            'payLink' => $inv->isQuote() ? null : $inv->getOwner()->getPayLink(),
            'issuedOn' => $inv->getIssuedOn()->format('Y-m-d'),
            'dueOn' => $inv->getDueOn()->format('Y-m-d'),
            'paidAt' => $inv->getPaidAt()?->format(DATE_ATOM),
            'currency' => $inv->getCurrency(),
            'subtotal' => $inv->subtotal(),
            'discount' => $inv->discount(),
            'tax' => $inv->tax(),
            'taxRate' => $inv->getTaxRate(),
            'taxLabel' => $inv->getTaxLabel(),
            'total' => $inv->total(),
            'paid' => $inv->paid(),
            'balance' => $inv->balance(),
            'notes' => $inv->getNotes(),
            'lines' => $lines,
            'payments' => $payments,
            'noticeSent' => $inv->notice() !== null,
        ]);
        $res->headers->set('Cache-Control', 'no-store');
        $res->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $res;
    }
}
