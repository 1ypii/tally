<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class LineInput
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 200)]
        public string $description = '',

        #[Assert\Range(min: 0.01, max: 10000)]
        public float $quantity = 1,

        #[Assert\Range(min: 0, max: 100_000_000_000)]
        public int $unitPrice = 0,

        public bool $fixed = false,
    ) {
    }
}
