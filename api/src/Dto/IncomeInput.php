<?php

namespace App\Dto;

use App\Entity\Currency;
use App\Entity\Payment;
use Symfony\Component\Validator\Constraints as Assert;

final class IncomeInput
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 120)]
        public string $source = '',

        #[Assert\Length(max: 60)]
        public ?string $reference = null,

        #[Assert\Positive]
        #[Assert\LessThanOrEqual(100_000_000_000)]
        public int $amount = 0,

        #[Assert\Choice(choices: Currency::codes, message: 'pick a supported currency')]
        public string $currency = 'usd',

        #[Assert\NotBlank]
        #[Assert\Date]
        public string $receivedOn = '',

        #[Assert\Choice(choices: Payment::methods, message: 'pick a payment method')]
        public string $method = 'other',

        #[Assert\Length(max: 500)]
        public ?string $note = null,
    ) {
    }
}
