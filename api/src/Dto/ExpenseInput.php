<?php

namespace App\Dto;

use App\Entity\Currency;
use Symfony\Component\Validator\Constraints as Assert;

final class ExpenseInput
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 200)]
        public string $description = '',

        #[Assert\Positive]
        #[Assert\LessThanOrEqual(100_000_000_000)]
        public int $amount = 0,

        #[Assert\Choice(choices: Currency::codes, message: 'pick a supported currency')]
        public string $currency = 'usd',

        #[Assert\NotBlank]
        #[Assert\Date]
        public string $spentOn = '',

        #[Assert\Positive]
        public ?int $categoryId = null,
    ) {
    }
}
