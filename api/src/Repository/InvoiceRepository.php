<?php

namespace App\Repository;

use App\Entity\Invoice;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class InvoiceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Invoice::class);
    }

    public function listFor(User $owner): array
    {
        return $this->createQueryBuilder('i')
            ->addSelect('c', 'l', 'p')
            ->join('i.client', 'c')
            ->leftJoin('i.lines', 'l')
            ->leftJoin('i.payments', 'p')
            ->where('i.owner = :owner')
            ->setParameter('owner', $owner)
            ->orderBy('i.seq', 'DESC')
            ->getQuery()
            ->getResult();
    }

    public function nextSeq(User $owner, string $kind): int
    {
        $max = $this->createQueryBuilder('i')
            ->select('MAX(i.seq)')
            ->where('i.owner = :owner')
            ->andWhere('i.kind = :kind')
            ->setParameter('owner', $owner)
            ->setParameter('kind', $kind)
            ->getQuery()
            ->getSingleScalarResult();

        return (int) $max + 1;
    }
}
