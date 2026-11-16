<?php

namespace App\Dto;

use App\Entity\Payment;
use Symfony\Component\Validator\Constraints as Assert;

final class PaymentInput
{
    public function __construct(
        #[Assert\Positive]
        #[Assert\LessThanOrEqual(100_000_000_000)]
        public int $amount = 0,

        #[Assert\NotBlank]
        #[Assert\Date]
        public string $paidOn = '',

        #[Assert\Choice(choices: Payment::methods, message: 'pick a payment method')]
        public string $method = 'bank',

        #[Assert\Length(max: 500)]
        public ?string $note = null,
    ) {
    }
}
