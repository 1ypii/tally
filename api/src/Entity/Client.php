<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class Client
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\Column(length: 120)]
    private string $name = '';

    #[ORM\Column(length: 180, nullable: true)]
    private ?string $email = null;

    #[ORM\Column(length: 253, nullable: true)]
    private ?string $website = null;

    #[ORM\Column]
    private int $rate = 0;

    #[ORM\Column(length: 3)]
    private string $currency = 'usd';

    #[ORM\Column(length: 300, nullable: true)]
    private ?string $location = null;

    #[ORM\Column(length: 60, nullable: true)]
    private ?string $taxId = null;

    #[ORM\Column(length: 40, nullable: true)]
    private ?string $phone = null;

    #[ORM\Column(options: ['default' => 14])]
    private int $termsDays = 14;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(User $owner)
    {
        $this->owner = $owner;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(?string $email): void
    {
        $this->email = $email;
    }

    public function getWebsite(): ?string
    {
        return $this->website;
    }

    public function setWebsite(?string $website): void
    {
        $this->website = $website;
    }

    public function getRate(): int
    {
        return $this->rate;
    }

    public function setRate(int $cents): void
    {
        $this->rate = $cents;
    }

    public function getLocation(): ?string
    {
        return $this->location;
    }

    public function getTaxId(): ?string
    {
        return $this->taxId;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setExtras(?string $location, ?string $taxId, ?string $phone): void
    {
        $this->location = $location;
        $this->taxId = $taxId;
        $this->phone = $phone;
    }

    public function getTermsDays(): int
    {
        return $this->termsDays;
    }

    public function setTermsDays(int $days): void
    {
        $this->termsDays = $days;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function setCurrency(string $currency): void
    {
        $this->currency = $currency;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }
}
