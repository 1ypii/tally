<?php

namespace App;

use App\Entity\Invoice;
use App\Entity\User;
use App\Repository\InvoiceRepository;
use Doctrine\ORM\EntityManagerInterface;

final class Recurring
{
    private const maxPerRun = 24;

    public function __construct(
        private EntityManagerInterface $em,
        private InvoiceRepository $invoices,
    ) {
    }

    public function run(User $user): void
    {
        $today = new \DateTimeImmutable('today');
        $templates = $this->invoices->createQueryBuilder('i')
            ->where('i.owner = :owner')
            ->andWhere('i.repeatEvery IS NOT NULL')
            ->andWhere('i.nextRepeatOn <= :today')
            ->setParameter('owner', $user)
            ->setParameter('today', $today, 'date_immutable')
            ->getQuery()
            ->getResult();

        if (!$templates) {
            return;
        }

        $seq = $this->invoices->nextSeq($user, 'invoice');
        $made = 0;

        foreach ($templates as $template) {
            while ($template->getNextRepeatOn() && $template->getNextRepeatOn() <= $today && $made < self::maxPerRun) {
                $issued = $template->getNextRepeatOn();
                $due = $issued->modify('+'.$template->getClient()->getTermsDays().' days');
                $copy = $template->copy('invoice', $seq, $user->prefixFor('invoice').str_pad((string) $seq, 4, '0', STR_PAD_LEFT), $issued, $due);
                $this->em->persist($copy);
                $template->advanceRepeat();
                $seq++;
                $made++;
            }
        }

        $this->em->flush();
    }
}
