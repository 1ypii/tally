<?php

namespace App\Controller;

use App\Demo\DemoAccounts;
use App\Entity\Category;
use App\Entity\Client;
use App\Entity\Expense;
use App\Entity\Income;
use App\Entity\Invoice;
use App\Entity\User;
use App\Repository\InvoiceRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/account')]
final class AccountController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserPasswordHasherInterface $hasher,
        private RateLimiterFactoryInterface $passwordLimiter,
    ) {
    }

    #[Route('/password', methods: ['POST'])]
    public function password(#[CurrentUser] User $user, Request $request, Security $security): JsonResponse
    {
        if ($user->isDemo()) {
            return $this->json(['error' => 'demo accounts do not have a password'], 409);
        }
        if (!$this->passwordLimiter->create('u'.$user->getId())->consume()->isAccepted()) {
            return $this->json(['error' => 'too many tries, wait a few minutes'], 429);
        }

        $body = json_decode($request->getContent(), true);
        $current = is_array($body) && is_string($body['current'] ?? null) ? $body['current'] : '';
        $next = is_array($body) && is_string($body['password'] ?? null) ? $body['password'] : '';

        if (!$this->hasher->isPasswordValid($user, $current)) {
            return $this->json(['error' => 'your current password is wrong'], 422);
        }
        if (mb_strlen($next) < 10 || mb_strlen($next) > 4096) {
            return $this->json(['error' => 'the new password needs at least 10 characters'], 422);
        }

        $user->setPassword($this->hasher->hashPassword($user, $next));
        $this->em->flush();
        $request->getSession()->migrate(true);
        $security->login($user, 'json_login', 'main');

        return $this->json(['ok' => true]);
    }

    #[Route('/export', methods: ['GET'])]
    public function export(#[CurrentUser] User $user, InvoiceRepository $invoices): Response
    {
        $data = [
            'exportedAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
            'account' => ['email' => $user->getEmail()] + $user->profile() + $user->settings(),
            'clients' => [],
            'invoices' => [],
            'income' => [],
            'expenses' => [],
            'categories' => [],
        ];

        foreach ($this->em->getRepository(Client::class)->findBy(['owner' => $user]) as $c) {
            $data['clients'][] = [
                'name' => $c->getName(),
                'email' => $c->getEmail(),
                'website' => $c->getWebsite(),
                'location' => $c->getLocation(),
                'taxId' => $c->getTaxId(),
                'phone' => $c->getPhone(),
                'rate' => $c->getRate(),
                'currency' => $c->getCurrency(),
                'termsDays' => $c->getTermsDays(),
            ];
        }

        foreach ($invoices->listFor($user) as $inv) {
            $lines = [];
            foreach ($inv->getLines() as $l) {
                $lines[] = ['description' => $l->getDescription(), 'quantity' => $l->getQuantity() / 100, 'unitPrice' => $l->getUnitPrice(), 'fixed' => $l->isFixed(), 'amount' => $l->amount()];
            }
            $payments = [];
            foreach ($inv->getPayments() as $p) {
                $payments[] = $p->toJson();
            }
            $data['invoices'][] = [
                'kind' => $inv->getKind(),
                'number' => $inv->number(),
                'status' => $inv->getStatus()->value,
                'client' => $inv->getClient()->getName(),
                'currency' => $inv->getCurrency(),
                'issuedOn' => $inv->getIssuedOn()->format('Y-m-d'),
                'dueOn' => $inv->getDueOn()->format('Y-m-d'),
                'subtotal' => $inv->subtotal(),
                'discount' => $inv->discount(),
                'tax' => $inv->tax(),
                'total' => $inv->total(),
                'notes' => $inv->getNotes(),
                'lines' => $lines,
                'payments' => $payments,
            ];
        }

        foreach ($this->em->getRepository(Income::class)->findBy(['owner' => $user]) as $i) {
            $data['income'][] = $i->toJson();
        }
        foreach ($this->em->getRepository(Expense::class)->findBy(['owner' => $user]) as $e) {
            $data['expenses'][] = $e->toJson();
        }
        foreach ($this->em->getRepository(Category::class)->findBy(['owner' => $user]) as $c) {
            $data['categories'][] = $c->getName();
        }

        $res = new JsonResponse($data);
        $res->headers->set('Content-Disposition', 'attachment; filename="tally-export.json"');
        $res->headers->set('Cache-Control', 'no-store');

        return $res;
    }

    #[Route('', methods: ['DELETE'])]
    public function delete(#[CurrentUser] User $user, Request $request, Security $security, DemoAccounts $accounts): JsonResponse
    {
        if (!$user->isDemo()) {
            if (!$this->passwordLimiter->create('u'.$user->getId())->consume()->isAccepted()) {
                return $this->json(['error' => 'too many tries, wait a few minutes'], 429);
            }
            $body = json_decode($request->getContent(), true);
            $password = is_array($body) && is_string($body['password'] ?? null) ? $body['password'] : '';
            if (!$this->hasher->isPasswordValid($user, $password)) {
                return $this->json(['error' => 'that password is wrong'], 422);
            }
        }

        $id = $user->getId();
        $security->logout(false);
        $accounts->deleteUsers([$id]);

        return new JsonResponse(null, 204);
    }
}
