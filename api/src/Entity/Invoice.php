<?php

namespace App\Entity;

use App\Repository\InvoiceRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: InvoiceRepository::class)]
#[ORM\UniqueConstraint(columns: ['owner_id', 'kind', 'seq'])]
#[ORM\Index(columns: ['owner_id', 'next_repeat_on'])]
class Invoice
{
    public const repeats = ['weekly', 'monthly', 'quarterly', 'yearly'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private Client $client;

    #[ORM\Column(length: 10)]
    private string $kind;

    #[ORM\Column]
    private int $seq;

    #[ORM\Column(length: 40)]
    private string $number;

    #[ORM\Column(length: 10, enumType: InvoiceStatus::class)]
    private InvoiceStatus $status = InvoiceStatus::Draft;

    #[ORM\Column(length: 3)]
    private string $currency = 'usd';

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $issuedOn;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $dueOn;

    #[ORM\Column(length: 2000, nullable: true)]
    private ?string $notes = null;

    #[ORM\Column]
    private int $taxRate = 0;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $taxLabel = null;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $discountKind = null;

    #[ORM\Column]
    private int $discountValue = 0;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $sentAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $paidAt = null;

    #[ORM\Column(length: 43, unique: true, nullable: true)]
    private ?string $shareToken = null;

    #[ORM\Column(options: ['default' => true])]
    private bool $showSender = true;

    #[ORM\Column(options: ['default' => true])]
    private bool $showLogo = true;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $repeatEvery = null;

    #[ORM\Column(type: 'date_immutable', nullable: true)]
    private ?\DateTimeImmutable $nextRepeatOn = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $remindedAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $firstViewedAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $lastViewedAt = null;

    #[ORM\Column]
    private int $viewCount = 0;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $noticeAt = null;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $noticeRef = null;

    #[ORM\Column(length: 300, nullable: true)]
    private ?string $noticeNote = null;

    #[ORM\Column(nullable: true)]
    private ?int $convertedTo = null;

    #[ORM\OneToMany(targetEntity: InvoiceLine::class, mappedBy: 'invoice', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    private Collection $lines;

    #[ORM\OneToMany(targetEntity: Payment::class, mappedBy: 'invoice', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['paidOn' => 'ASC', 'id' => 'ASC'])]
    private Collection $payments;

    public function __construct(User $owner, Client $client, string $kind, int $seq, string $number)
    {
        $this->owner = $owner;
        $this->client = $client;
        $this->kind = $kind;
        $this->seq = $seq;
        $this->number = $number;
        $this->issuedOn = new \DateTimeImmutable('today');
        $this->dueOn = $this->issuedOn->modify('+14 days');
        $this->lines = new ArrayCollection();
        $this->payments = new ArrayCollection();
    }

    public function copy(string $kind, int $seq, string $number, \DateTimeImmutable $issuedOn, \DateTimeImmutable $dueOn): self
    {
        $copy = new self($this->owner, $this->client, $kind, $seq, $number);
        $copy->currency = $this->currency;
        $copy->notes = $this->notes;
        $copy->taxRate = $this->taxRate;
        $copy->taxLabel = $this->taxLabel;
        $copy->discountKind = $this->discountKind;
        $copy->discountValue = $this->discountValue;
        $copy->showSender = $this->showSender;
        $copy->showLogo = $this->showLogo;
        $copy->setDates($issuedOn, $dueOn);

        $lines = [];
        foreach ($this->lines as $line) {
            $lines[] = [$line->getDescription(), $line->getQuantity(), $line->getUnitPrice(), $line->isFixed()];
        }
        $copy->replaceLines($lines);

        return $copy;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }

    public function getKind(): string
    {
        return $this->kind;
    }

    public function isQuote(): bool
    {
        return $this->kind === 'quote';
    }

    public function number(): string
    {
        return $this->number;
    }

    public function showsSender(): bool
    {
        return $this->showSender;
    }

    public function setShowSender(bool $show): void
    {
        $this->showSender = $show;
    }

    public function showsLogo(): bool
    {
        return $this->showLogo;
    }

    public function setShowLogo(bool $show): void
    {
        $this->showLogo = $show;
    }

    public function logoVisible(): bool
    {
        return $this->showLogo && $this->owner->getLogo() !== null;
    }

    public function unsend(): void
    {
        $this->status = InvoiceStatus::Draft;
        $this->sentAt = null;
        $this->shareToken = null;
        $this->noticeAt = null;
        $this->noticeRef = null;
        $this->noticeNote = null;
    }

    public function clearPayments(): void
    {
        $this->payments->clear();
        $this->status = InvoiceStatus::Sent;
        $this->paidAt = null;
    }

    public function getShareToken(): ?string
    {
        return $this->shareToken;
    }

    public function newShareToken(): string
    {
        $this->shareToken = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

        return $this->shareToken;
    }

    public function revokeShareToken(): void
    {
        $this->shareToken = null;
    }

    public function getClient(): Client
    {
        return $this->client;
    }

    public function setClient(Client $client): void
    {
        $this->client = $client;
    }

    public function getStatus(): InvoiceStatus
    {
        return $this->status;
    }

    public function setQuoteAnswer(bool $accepted): void
    {
        $this->status = $accepted ? InvoiceStatus::Accepted : InvoiceStatus::Declined;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function setCurrency(string $currency): void
    {
        $this->currency = $currency;
    }

    public function getIssuedOn(): \DateTimeImmutable
    {
        return $this->issuedOn;
    }

    public function getDueOn(): \DateTimeImmutable
    {
        return $this->dueOn;
    }

    public function setDates(\DateTimeImmutable $issuedOn, \DateTimeImmutable $dueOn): void
    {
        $this->issuedOn = $issuedOn;
        $this->dueOn = $dueOn;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function setAdjustments(int $taxRate, ?string $taxLabel, ?string $discountKind, int $discountValue): void
    {
        $this->taxRate = $taxRate;
        $this->taxLabel = $taxLabel;
        $this->discountKind = $discountKind;
        $this->discountValue = $discountKind ? $discountValue : 0;
    }

    public function getTaxRate(): int
    {
        return $this->taxRate;
    }

    public function getTaxLabel(): ?string
    {
        return $this->taxLabel;
    }

    public function getDiscountKind(): ?string
    {
        return $this->discountKind;
    }

    public function getDiscountValue(): int
    {
        return $this->discountValue;
    }

    public function getSentAt(): ?\DateTimeImmutable
    {
        return $this->sentAt;
    }

    public function getPaidAt(): ?\DateTimeImmutable
    {
        return $this->paidAt;
    }

    public function getRepeatEvery(): ?string
    {
        return $this->repeatEvery;
    }

    public function getNextRepeatOn(): ?\DateTimeImmutable
    {
        return $this->nextRepeatOn;
    }

    public function setRepeat(?string $every, ?\DateTimeImmutable $next): void
    {
        $this->repeatEvery = $every;
        $this->nextRepeatOn = $every ? $next : null;
    }

    public function advanceRepeat(): void
    {
        $step = match ($this->repeatEvery) {
            'weekly' => '+1 week',
            'monthly' => '+1 month',
            'quarterly' => '+3 months',
            'yearly' => '+1 year',
            default => null,
        };
        $this->nextRepeatOn = $step && $this->nextRepeatOn ? $this->nextRepeatOn->modify($step) : null;
    }

    public function getRemindedAt(): ?\DateTimeImmutable
    {
        return $this->remindedAt;
    }

    public function markReminded(\DateTimeImmutable $at): void
    {
        $this->remindedAt = $at;
    }

    public function recordView(\DateTimeImmutable $at): void
    {
        $this->firstViewedAt ??= $at;
        $this->lastViewedAt = $at;
        $this->viewCount++;
    }

    public function views(): array
    {
        return [
            'first' => $this->firstViewedAt?->format(DATE_ATOM),
            'last' => $this->lastViewedAt?->format(DATE_ATOM),
            'count' => $this->viewCount,
        ];
    }

    public function setNotice(?string $ref, ?string $note, ?\DateTimeImmutable $at): void
    {
        $this->noticeRef = $ref;
        $this->noticeNote = $note;
        $this->noticeAt = $at;
    }

    public function notice(): ?array
    {
        if (!$this->noticeAt) {
            return null;
        }

        return ['at' => $this->noticeAt->format(DATE_ATOM), 'reference' => $this->noticeRef, 'note' => $this->noticeNote];
    }

    public function getConvertedTo(): ?int
    {
        return $this->convertedTo;
    }

    public function setConvertedTo(int $id): void
    {
        $this->convertedTo = $id;
    }

    public function getLines(): Collection
    {
        return $this->lines;
    }

    public function replaceLines(array $lines): void
    {
        $this->lines->clear();
        foreach (array_values($lines) as $i => [$description, $quantity, $unitPrice, $fixed]) {
            $this->lines->add(new InvoiceLine($this, $i, $description, $quantity, $unitPrice, $fixed));
        }
    }

    public function markSent(\DateTimeImmutable $at): void
    {
        $this->status = InvoiceStatus::Sent;
        $this->sentAt = $at;
    }

    public function markPaid(\DateTimeImmutable $at): void
    {
        $this->status = InvoiceStatus::Paid;
        $this->paidAt = $at;
        $this->noticeAt = null;
        $this->noticeRef = null;
        $this->noticeNote = null;
    }

    public function subtotal(): int
    {
        $sum = 0;
        foreach ($this->lines as $line) {
            $sum += $line->amount();
        }
        return $sum;
    }

    public function discount(): int
    {
        $subtotal = $this->subtotal();
        $off = match ($this->discountKind) {
            'percent' => intdiv($subtotal * $this->discountValue + 5000, 10000),
            'amount' => $this->discountValue,
            default => 0,
        };

        return min($off, $subtotal);
    }

    public function tax(): int
    {
        return intdiv(($this->subtotal() - $this->discount()) * $this->taxRate + 5000, 10000);
    }

    public function total(): int
    {
        return $this->subtotal() - $this->discount() + $this->tax();
    }

    public function getPayments(): Collection
    {
        return $this->payments;
    }

    public function addPayment(Payment $payment): void
    {
        $this->payments->add($payment);
        if ($this->balance() <= 0) {
            $this->markPaid($payment->getPaidOn());
        }
    }

    public function removePayment(Payment $payment): void
    {
        $this->payments->removeElement($payment);
        if ($this->status === InvoiceStatus::Paid && $this->balance() > 0) {
            $this->status = InvoiceStatus::Sent;
            $this->paidAt = null;
        }
    }

    public function paid(): int
    {
        $sum = 0;
        foreach ($this->payments as $payment) {
            $sum += $payment->getAmount();
        }
        return $sum;
    }

    public function balance(): int
    {
        return $this->total() - $this->paid();
    }

    public function isOverdue(\DateTimeImmutable $today): bool
    {
        return !$this->isQuote() && $this->status === InvoiceStatus::Sent && $this->dueOn < $today;
    }
}
