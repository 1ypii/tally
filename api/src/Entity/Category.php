<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\UniqueConstraint(columns: ['owner_id', 'name'])]
class Category
{
    public const defaults = ['software', 'hosting', 'hardware', 'assets', 'fees', 'taxes', 'other'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\Column(length: 40)]
    private string $name;

    public function __construct(User $owner, string $name)
    {
        $this->owner = $owner;
        $this->name = $name;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function rename(string $name): void
    {
        $this->name = $name;
    }

    public function toJson(): array
    {
        return ['id' => $this->id, 'name' => $this->name];
    }

    public function getOwner(): User
    {
        return $this->owner;
    }
}
