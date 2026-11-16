<?php

namespace App\Dto;

use App\Entity\Currency;
use Symfony\Component\Validator\Constraints as Assert;

final class ProfileInput
{
    public function __construct(
        #[Assert\Length(max: 120)]
        public ?string $businessName = null,

        #[Assert\Email]
        #[Assert\Length(max: 180)]
        public ?string $contactEmail = null,

        #[Assert\Length(max: 300)]
        public ?string $location = null,

        #[Assert\Length(max: 60)]
        public ?string $taxId = null,

        #[Assert\Length(max: 300)]
        public ?string $website = null,

        #[Assert\Length(max: 600)]
        public ?string $paymentDetails = null,

        #[Assert\Regex(pattern: '/^[A-Za-z0-9\-_.\/#]{0,16}$/', message: 'prefixes can use letters, numbers and - _ . / # up to 16 characters')]
        public string $invoicePrefix = 'INV-',

        #[Assert\Regex(pattern: '/^[A-Za-z0-9\-_.\/#]{0,16}$/', message: 'prefixes can use letters, numbers and - _ . / # up to 16 characters')]
        public string $quotePrefix = 'Q-',

        #[Assert\Choice(choices: Currency::codes, message: 'pick a supported currency')]
        public string $homeCurrency = 'usd',

        #[Assert\Range(min: 1, max: 1_000_000_000)]
        public ?int $robuxValue = null,

        #[Assert\Length(max: 300)]
        public ?string $payLink = null,
    ) {
    }
}
