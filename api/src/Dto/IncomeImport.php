<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class IncomeImport
{
    public function __construct(
        /** @var IncomeInput[] */
        #[Assert\Count(min: 1, max: 500)]
        #[Assert\Valid]
        public array $rows = [],
    ) {
    }
}
