<?php

namespace App\Controller;

use App\Dto\CategoryInput;
use App\Dto\ExpenseInput;
use App\Dto\IncomeImport;
use App\Dto\IncomeInput;
use App\Entity\Category;
use App\Entity\Expense;
use App\Entity\Income;
use App\Entity\Payment;
use App\Entity\User;
use App\Website;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api')]
final class BooksController extends AbstractController
{
    private const maxCategories = 50;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    #[Route('/payments', methods: ['GET'])]
    public function payments(#[CurrentUser] User $user): JsonResponse
    {
        $payments = $this->em->createQueryBuilder()
            ->select('p', 'i', 'c')
            ->from(Payment::class, 'p')
            ->join('p.invoice', 'i')
            ->join('i.client', 'c')
            ->where('p.owner = :owner')
            ->setParameter('owner', $user)
            ->orderBy('p.paidOn', 'DESC')
            ->addOrderBy('p.id', 'DESC')
            ->getQuery()
            ->getResult();

        $rows = [];
        foreach ($payments as $p) {
            $inv = $p->getInvoice();
            $rows[] = $p->toJson() + [
                'currency' => $inv->getCurrency(),
                'invoice' => ['id' => $inv->getId(), 'number' => $inv->number()],
                'client' => ['id' => $inv->getClient()->getId(), 'name' => $inv->getClient()->getName()],
            ];
        }

        return $this->json($rows);
    }

    #[Route('/payments/{id}', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function deletePayment(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $payment = $this->em->getRepository(Payment::class)->findOneBy(['id' => $id, 'owner' => $user])
            ?? throw $this->createNotFoundException();

        $payment->getInvoice()->removePayment($payment);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    #[Route('/categories', methods: ['GET'])]
    public function categories(#[CurrentUser] User $user): JsonResponse
    {
        $categories = $this->em->getRepository(Category::class)->findBy(['owner' => $user], ['name' => 'ASC']);

        return $this->json(array_map(fn (Category $c) => $c->toJson(), $categories));
    }

    #[Route('/categories', methods: ['POST'])]
    public function createCategory(#[CurrentUser] User $user, #[MapRequestPayload] CategoryInput $input): JsonResponse
    {
        $repo = $this->em->getRepository(Category::class);
        if ($repo->count(['owner' => $user]) >= self::maxCategories) {
            return $this->json(['error' => 'you can have up to 50 categories'], 422);
        }

        $name = mb_strtolower(trim($input->name));
        if ($repo->findOneBy(['owner' => $user, 'name' => $name])) {
            return $this->json(['error' => 'that category already exists'], 409);
        }

        $category = new Category($user, $name);
        $this->em->persist($category);
        $this->em->flush();

        return $this->json($category->toJson(), 201);
    }

    #[Route('/categories/{id}', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function renameCategory(#[CurrentUser] User $user, int $id, #[MapRequestPayload] CategoryInput $input): JsonResponse
    {
        $category = $this->findCategory($user, $id) ?? throw $this->createNotFoundException();
        $name = mb_strtolower(trim($input->name));
        $taken = $this->em->getRepository(Category::class)->findOneBy(['owner' => $user, 'name' => $name]);
        if ($taken && $taken !== $category) {
            return $this->json(['error' => 'that category already exists'], 409);
        }

        $category->rename($name);
        $this->em->flush();

        return $this->json($category->toJson());
    }

    #[Route('/categories/{id}', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function deleteCategory(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $category = $this->findCategory($user, $id) ?? throw $this->createNotFoundException();

        $this->em->createQuery('UPDATE '.Expense::class.' e SET e.category = NULL WHERE e.category = :category AND e.owner = :owner')
            ->setParameter('category', $category)
            ->setParameter('owner', $user)
            ->execute();
        $this->em->remove($category);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    #[Route('/expenses', methods: ['GET'])]
    public function expenses(#[CurrentUser] User $user): JsonResponse
    {
        $expenses = $this->em->getRepository(Expense::class)->findBy(['owner' => $user], ['spentOn' => 'DESC', 'id' => 'DESC']);

        return $this->json(array_map(fn (Expense $e) => $e->toJson(), $expenses));
    }

    #[Route('/expenses', methods: ['POST'])]
    public function createExpense(#[CurrentUser] User $user, #[MapRequestPayload] ExpenseInput $input): JsonResponse
    {
        $expense = new Expense($user);
        if (!$this->applyExpense($user, $expense, $input)) {
            return $this->json(['error' => 'category not found'], 422);
        }
        $this->em->persist($expense);
        $this->em->flush();

        return $this->json($expense->toJson(), 201);
    }

    #[Route('/expenses/{id}', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function updateExpense(#[CurrentUser] User $user, int $id, #[MapRequestPayload] ExpenseInput $input): JsonResponse
    {
        $expense = $this->findExpense($user, $id);
        if (!$this->applyExpense($user, $expense, $input)) {
            return $this->json(['error' => 'category not found'], 422);
        }
        $this->em->flush();

        return $this->json($expense->toJson());
    }

    #[Route('/expenses/{id}', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function deleteExpense(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $expense = $this->findExpense($user, $id);
        $receipt = $expense->getReceipt();
        $this->em->remove($expense);
        if ($receipt) {
            $this->em->remove($receipt);
        }
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    #[Route('/income', methods: ['GET'])]
    public function income(#[CurrentUser] User $user): JsonResponse
    {
        $rows = $this->em->getRepository(Income::class)->findBy(['owner' => $user], ['receivedOn' => 'DESC', 'id' => 'DESC']);

        return $this->json(array_map(fn (Income $i) => $i->toJson(), $rows));
    }

    #[Route('/income', methods: ['POST'])]
    public function createIncome(#[CurrentUser] User $user, #[MapRequestPayload] IncomeInput $input): JsonResponse
    {
        $income = new Income($user);
        $this->applyIncome($income, $input);
        $this->em->persist($income);
        $this->em->flush();

        return $this->json($income->toJson(), 201);
    }

    #[Route('/income/import', methods: ['POST'])]
    public function importIncome(#[CurrentUser] User $user, #[MapRequestPayload] IncomeImport $input): JsonResponse
    {
        foreach ($input->rows as $row) {
            $income = new Income($user);
            $this->applyIncome($income, $row);
            $this->em->persist($income);
        }
        $this->em->flush();

        return $this->json(['imported' => count($input->rows)], 201);
    }

    #[Route('/income/{id}', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function updateIncome(#[CurrentUser] User $user, int $id, #[MapRequestPayload] IncomeInput $input): JsonResponse
    {
        $income = $this->findIncome($user, $id);
        $this->applyIncome($income, $input);
        $this->em->flush();

        return $this->json($income->toJson());
    }

    #[Route('/income/{id}', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function deleteIncome(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $this->em->remove($this->findIncome($user, $id));
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    private function findCategory(User $user, int $id): ?Category
    {
        return $this->em->getRepository(Category::class)->findOneBy(['id' => $id, 'owner' => $user]);
    }

    private function findExpense(User $user, int $id): Expense
    {
        return $this->em->getRepository(Expense::class)->findOneBy(['id' => $id, 'owner' => $user])
            ?? throw $this->createNotFoundException();
    }

    private function findIncome(User $user, int $id): Income
    {
        return $this->em->getRepository(Income::class)->findOneBy(['id' => $id, 'owner' => $user])
            ?? throw $this->createNotFoundException();
    }

    private function applyExpense(User $user, Expense $expense, ExpenseInput $input): bool
    {
        $category = null;
        if ($input->categoryId !== null) {
            $category = $this->findCategory($user, $input->categoryId);
            if (!$category) {
                return false;
            }
        }

        $expense->update(
            trim($input->description),
            $input->amount,
            $input->currency,
            new \DateTimeImmutable($input->spentOn),
            $category,
        );

        return true;
    }

    private function applyIncome(Income $income, IncomeInput $input): void
    {
        $income->update(
            trim($input->source),
            Website::clean($input->reference),
            $input->amount,
            $input->currency,
            new \DateTimeImmutable($input->receivedOn),
            $input->method,
            Website::clean($input->note),
        );
    }
}
