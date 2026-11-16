<?php

namespace App\Demo;

use App\Entity\Category;
use App\Entity\Client;
use App\Entity\Expense;
use App\Entity\Income;
use App\Entity\Invoice;
use App\Entity\InvoiceLine;
use App\Entity\Payment;
use App\Entity\Upload;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

final class DemoAccounts
{
    private const maxAccounts = 1000;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    public function create(): ?User
    {
        $this->purge();

        $count = $this->em->getRepository(User::class)->count(['demo' => true]);
        if ($count >= self::maxAccounts) {
            return null;
        }

        $user = new User('demo-'.bin2hex(random_bytes(12)).'@demo.local', true);
        $user->setPassword('!');
        $this->em->persist($user);
        foreach (Category::defaults as $name) {
            $this->em->persist(new Category($user, $name));
        }
        $this->em->flush();

        return $user;
    }

    private function purge(): void
    {
        $ids = $this->em->createQuery('SELECT u.id FROM '.User::class.' u WHERE u.demo = true AND u.createdAt < :cutoff')
            ->setParameter('cutoff', new \DateTimeImmutable('-1 day'))
            ->getSingleColumnResult();

        if ($ids) {
            $this->deleteUsers($ids);
        }
    }

    public function deleteUsers(array $ids): void
    {
        $this->em->createQuery('UPDATE '.User::class.' u SET u.logo = NULL WHERE u.id IN (:ids)')
            ->setParameter('ids', $ids)
            ->execute();

        $this->em->createQuery('DELETE FROM '.InvoiceLine::class.' l WHERE l.invoice IN (SELECT i.id FROM '.Invoice::class.' i WHERE i.owner IN (:ids))')
            ->setParameter('ids', $ids)
            ->execute();

        foreach ([Payment::class, Expense::class, Upload::class, Income::class, Category::class, Invoice::class, Client::class] as $class) {
            $this->em->createQuery('DELETE FROM '.$class.' x WHERE x.owner IN (:ids)')
                ->setParameter('ids', $ids)
                ->execute();
        }

        $this->em->createQuery('DELETE FROM '.User::class.' u WHERE u.id IN (:ids)')
            ->setParameter('ids', $ids)
            ->execute();
    }
}
