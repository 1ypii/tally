<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Index(columns: ['owner_id', 'paid_on'])]
class Payment
{
    public const methods = ['bank', 'paypal', 'wise', 'payoneer', 'stripe', 'card', 'crypto', 'cash', 'robloxgroup', 'devex', 'other'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\ManyToOne(inversedBy: 'payments')]
    #[ORM\JoinColumn(nullable: false)]
    private Invoice $invoice;

    #[ORM\Column]
    private int $amount;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $paidOn;

    #[ORM\Column(length: 20)]
    private string $method;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $note;

    public function __construct(User $owner, Invoice $invoice, int $amount, \DateTimeImmutable $paidOn, string $method, ?string $note)
    {
        $this->owner = $owner;
        $this->invoice = $invoice;
        $this->amount = $amount;
        $this->paidOn = $paidOn;
        $this->method = $method;
        $this->note = $note;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getInvoice(): Invoice
    {
        return $this->invoice;
    }

    public function getAmount(): int
    {
        return $this->amount;
    }

    public function getPaidOn(): \DateTimeImmutable
    {
        return $this->paidOn;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function toJson(): array
    {
        return [
            'id' => $this->id,
            'amount' => $this->amount,
            'paidOn' => $this->paidOn->format('Y-m-d'),
            'method' => $this->method,
            'note' => $this->note,
        ];
    }

    public function getOwner(): User
    {
        return $this->owner;
    }
}
