<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity]
#[ORM\Table(name: 'users')]
#[ORM\Index(columns: ['demo', 'created_at'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180, unique: true)]
    private string $email;

    #[ORM\Column]
    private string $password = '';

    #[ORM\Column]
    private bool $demo;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $businessName = null;

    #[ORM\Column(length: 180, nullable: true)]
    private ?string $contactEmail = null;

    #[ORM\Column(length: 300, nullable: true)]
    private ?string $location = null;

    #[ORM\Column(length: 60, nullable: true)]
    private ?string $taxId = null;

    #[ORM\Column(length: 253, nullable: true)]
    private ?string $website = null;

    #[ORM\Column(length: 600, nullable: true)]
    private ?string $paymentDetails = null;

    #[ORM\Column(length: 16, options: ['default' => 'INV-'])]
    private string $invoicePrefix = 'INV-';

    #[ORM\Column(length: 16, options: ['default' => 'Q-'])]
    private string $quotePrefix = 'Q-';

    #[ORM\Column(length: 3, options: ['default' => 'usd'])]
    private string $homeCurrency = 'usd';

    #[ORM\Column(nullable: true)]
    private ?int $robuxValue = null;

    #[ORM\Column(length: 300, nullable: true)]
    private ?string $payLink = null;

    #[ORM\Column(options: ['default' => 0])]
    private int $dataVersion = 0;

    #[ORM\ManyToOne(targetEntity: Upload::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Upload $logo = null;

    public function __construct(string $email, bool $demo = false)
    {
        $this->email = $email;
        $this->demo = $demo;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function isDemo(): bool
    {
        return $this->demo;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getRoles(): array
    {
        return ['ROLE_USER'];
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $hash): void
    {
        $this->password = $hash;
    }

    public function profile(): array
    {
        return [
            'businessName' => $this->businessName,
            'contactEmail' => $this->contactEmail,
            'location' => $this->location,
            'taxId' => $this->taxId,
            'website' => $this->website,
            'paymentDetails' => $this->paymentDetails,
        ];
    }

    public function setProfile(?string $businessName, ?string $contactEmail, ?string $location, ?string $taxId, ?string $website, ?string $paymentDetails): void
    {
        $this->businessName = $businessName;
        $this->contactEmail = $contactEmail;
        $this->location = $location;
        $this->taxId = $taxId;
        $this->website = $website;
        $this->paymentDetails = $paymentDetails;
    }

    public function settings(): array
    {
        return [
            'invoicePrefix' => $this->invoicePrefix,
            'quotePrefix' => $this->quotePrefix,
            'homeCurrency' => $this->homeCurrency,
            'robuxValue' => $this->robuxValue,
            'payLink' => $this->payLink,
            'hasLogo' => $this->logo !== null,
        ];
    }

    public function setSettings(string $invoicePrefix, string $quotePrefix, string $homeCurrency, ?int $robuxValue, ?string $payLink): void
    {
        $this->invoicePrefix = $invoicePrefix;
        $this->quotePrefix = $quotePrefix;
        $this->homeCurrency = $homeCurrency;
        $this->robuxValue = $robuxValue;
        $this->payLink = $payLink;
    }

    public function prefixFor(string $kind): string
    {
        return $kind === 'quote' ? $this->quotePrefix : $this->invoicePrefix;
    }

    public function getLogo(): ?Upload
    {
        return $this->logo;
    }

    public function setLogo(?Upload $logo): void
    {
        $this->logo = $logo;
    }

    public function getDataVersion(): int
    {
        return $this->dataVersion;
    }

    public function getPayLink(): ?string
    {
        return $this->payLink;
    }

    public function summary(): array
    {
        return ['email' => $this->demo ? null : $this->email, 'demo' => $this->demo];
    }
}
