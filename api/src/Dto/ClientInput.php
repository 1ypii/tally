<?php

namespace App\Dto;

use App\Entity\Currency;
use Symfony\Component\Validator\Constraints as Assert;

final class ClientInput
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 120)]
        public string $name = '',

        #[Assert\Email]
        #[Assert\Length(max: 180)]
        public ?string $email = null,

        #[Assert\Length(max: 300)]
        public ?string $website = null,

        #[Assert\Length(max: 300)]
        public ?string $location = null,

        #[Assert\Length(max: 60)]
        public ?string $taxId = null,

        #[Assert\Length(max: 40)]
        public ?string $phone = null,

        #[Assert\Range(min: 0, max: 365)]
        public int $termsDays = 14,

        #[Assert\Range(min: 0, max: 10_000_000)]
        public int $rate = 0,

        #[Assert\Choice(choices: Currency::codes, message: 'pick a supported currency')]
        public string $currency = 'usd',
    ) {
    }
}
