<?php

namespace App\Dto;

use App\Entity\Currency;
use Symfony\Component\Validator\Constraints as Assert;

final class InvoiceInput
{
    public function __construct(
        #[Assert\Positive]
        public int $clientId = 0,

        #[Assert\Choice(choices: Currency::codes, message: 'pick a supported currency')]
        public string $currency = 'usd',

        #[Assert\NotBlank]
        #[Assert\Date]
        public string $issuedOn = '',

        #[Assert\NotBlank]
        #[Assert\Date]
        #[Assert\GreaterThanOrEqual(propertyPath: 'issuedOn', message: 'due date cannot be before the issue date')]
        public string $dueOn = '',

        #[Assert\Length(max: 2000)]
        public ?string $notes = null,

        public bool $showSender = true,

        public bool $showLogo = true,

        #[Assert\Range(min: 0, max: 10000)]
        public int $taxRate = 0,

        #[Assert\Length(max: 20)]
        public ?string $taxLabel = null,

        #[Assert\Choice(choices: ['percent', 'amount'], message: 'pick a discount type')]
        public ?string $discountKind = null,

        #[Assert\Range(min: 0, max: 100_000_000_000)]
        public int $discountValue = 0,

        #[Assert\Choice(choices: ['invoice', 'quote'])]
        public string $kind = 'invoice',

        /** @var LineInput[] */
        #[Assert\Count(min: 1, max: 50)]
        #[Assert\Valid]
        public array $lines = [],
    ) {
    }
}
