<?php

namespace App\EventListener;

use App\Entity\InvoiceLine;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\ORM\Event\OnFlushEventArgs;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Events;

#[AsDoctrineListener(event: Events::onFlush)]
#[AsDoctrineListener(event: Events::postFlush)]
final class DataVersion
{
    private array $owners = [];

    public function onFlush(OnFlushEventArgs $args): void
    {
        $uow = $args->getObjectManager()->getUnitOfWork();
        $changed = [
            ...$uow->getScheduledEntityInsertions(),
            ...$uow->getScheduledEntityUpdates(),
            ...$uow->getScheduledEntityDeletions(),
        ];

        foreach ($changed as $entity) {
            $owner = match (true) {
                $entity instanceof User => $entity,
                $entity instanceof InvoiceLine => $entity->getInvoice()->getOwner(),
                method_exists($entity, 'getOwner') => $entity->getOwner(),
                default => null,
            };
            if ($owner instanceof User && $owner->getId() !== null) {
                $this->owners[$owner->getId()] = true;
            }
        }

        foreach ($uow->getScheduledCollectionUpdates() as $collection) {
            $owner = $collection->getOwner();
            if ($owner && method_exists($owner, 'getOwner') && $owner->getOwner() instanceof User && $owner->getOwner()->getId() !== null) {
                $this->owners[$owner->getOwner()->getId()] = true;
            }
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if (!$this->owners) {
            return;
        }

        $ids = array_keys($this->owners);
        $this->owners = [];

        $args->getObjectManager()->getConnection()->executeStatement(
            'UPDATE users SET data_version = data_version + 1 WHERE id IN (?)',
            [$ids],
            [ArrayParameterType::INTEGER],
        );
    }
}
