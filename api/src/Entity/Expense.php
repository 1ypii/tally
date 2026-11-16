<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Index(columns: ['owner_id', 'spent_on'])]
class Expense
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\Column(length: 200)]
    private string $description = '';

    #[ORM\Column]
    private int $amount = 0;

    #[ORM\Column(length: 3)]
    private string $currency = 'usd';

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $spentOn;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Category $category = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Upload $receipt = null;

    public function __construct(User $owner)
    {
        $this->owner = $owner;
        $this->spentOn = new \DateTimeImmutable('today');
    }

    public function update(string $description, int $amount, string $currency, \DateTimeImmutable $spentOn, ?Category $category): void
    {
        $this->description = $description;
        $this->amount = $amount;
        $this->currency = $currency;
        $this->spentOn = $spentOn;
        $this->category = $category;
    }

    public function getReceipt(): ?Upload
    {
        return $this->receipt;
    }

    public function setReceipt(?Upload $receipt): void
    {
        $this->receipt = $receipt;
    }

    public function toJson(): array
    {
        return [
            'id' => $this->id,
            'description' => $this->description,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'spentOn' => $this->spentOn->format('Y-m-d'),
            'category' => $this->category ? ['id' => $this->category->getId(), 'name' => $this->category->getName()] : null,
            'receipt' => $this->receipt ? ['mime' => $this->receipt->getMime(), 'size' => $this->receipt->getSize()] : null,
        ];
    }

    public function getOwner(): User
    {
        return $this->owner;
    }
}
