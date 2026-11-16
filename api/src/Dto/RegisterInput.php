<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class RegisterInput
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Email]
        #[Assert\Length(max: 180)]
        public string $email = '',

        #[Assert\NotBlank]
        #[Assert\Length(min: 10, max: 4096)]
        public string $password = '',
    ) {
    }
}
