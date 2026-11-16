<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class InvoiceLine
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'lines')]
    #[ORM\JoinColumn(nullable: false)]
    private Invoice $invoice;

    #[ORM\Column]
    private int $position;

    #[ORM\Column(length: 200)]
    private string $description;

    #[ORM\Column]
    private int $quantity;

    #[ORM\Column]
    private int $unitPrice;

    #[ORM\Column(options: ['default' => false])]
    private bool $fixed;

    public function __construct(Invoice $invoice, int $position, string $description, int $quantity, int $unitPrice, bool $fixed = false)
    {
        $this->fixed = $fixed;
        $this->invoice = $invoice;
        $this->position = $position;
        $this->description = $description;
        $this->quantity = $quantity;
        $this->unitPrice = $unitPrice;
    }

    public function getInvoice(): Invoice
    {
        return $this->invoice;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function getUnitPrice(): int
    {
        return $this->unitPrice;
    }

    public function isFixed(): bool
    {
        return $this->fixed;
    }

    public function amount(): int
    {
        return intdiv($this->quantity * $this->unitPrice + 50, 100);
    }
}
