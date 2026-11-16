<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Index(columns: ['owner_id', 'kind'])]
class Upload
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $owner;

    #[ORM\Column(length: 10)]
    private string $kind;

    #[ORM\Column(length: 40)]
    private string $mime;

    #[ORM\Column]
    private int $size;

    #[ORM\Column(type: 'blob')]
    private mixed $data;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(User $owner, string $kind, string $mime, string $data)
    {
        $this->owner = $owner;
        $this->kind = $kind;
        $this->mime = $mime;
        $this->size = strlen($data);
        $this->data = $data;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }

    public function getMime(): string
    {
        return $this->mime;
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function bytes(): string
    {
        if (is_resource($this->data)) {
            rewind($this->data);
            return (string) stream_get_contents($this->data);
        }

        return (string) $this->data;
    }
}
