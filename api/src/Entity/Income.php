<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Index(columns: ['owner_id', 'received_on'])]
class Income
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\Column(length: 120)]
    private string $source = '';

    #[ORM\Column(length: 60, nullable: true)]
    private ?string $reference = null;

    #[ORM\Column]
    private int $amount = 0;

    #[ORM\Column(length: 3)]
    private string $currency = 'usd';

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $receivedOn;

    #[ORM\Column(length: 20)]
    private string $method = 'other';

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $note = null;

    public function __construct(User $owner)
    {
        $this->owner = $owner;
        $this->receivedOn = new \DateTimeImmutable('today');
    }

    public function update(string $source, ?string $reference, int $amount, string $currency, \DateTimeImmutable $receivedOn, string $method, ?string $note): void
    {
        $this->source = $source;
        $this->reference = $reference;
        $this->amount = $amount;
        $this->currency = $currency;
        $this->receivedOn = $receivedOn;
        $this->method = $method;
        $this->note = $note;
    }

    public function toJson(): array
    {
        return [
            'id' => $this->id,
            'source' => $this->source,
            'reference' => $this->reference,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'receivedOn' => $this->receivedOn->format('Y-m-d'),
            'method' => $this->method,
            'note' => $this->note,
        ];
    }

    public function getOwner(): User
    {
        return $this->owner;
    }
}
