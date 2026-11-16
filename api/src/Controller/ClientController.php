<?php

namespace App\Controller;

use App\Dto\ClientInput;
use App\Entity\Client;
use App\Entity\Invoice;
use App\Entity\User;
use App\Website;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/clients')]
final class ClientController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    #[Route('', methods: ['GET'])]
    public function list(#[CurrentUser] User $user): JsonResponse
    {
        $clients = $this->em->getRepository(Client::class)->findBy(['owner' => $user], ['name' => 'ASC']);

        return $this->json(array_map($this->toJson(...), $clients));
    }

    #[Route('', methods: ['POST'])]
    public function create(#[CurrentUser] User $user, #[MapRequestPayload] ClientInput $input): JsonResponse
    {
        $website = Website::host($input->website);
        if ($website === false) {
            return $this->json(['error' => 'that website does not look right, use something like acme.com'], 422);
        }

        $client = new Client($user);
        $this->apply($client, $input, $website);
        $this->em->persist($client);
        $this->em->flush();

        return $this->json($this->toJson($client), 201);
    }

    #[Route('/{id}', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function update(#[CurrentUser] User $user, int $id, #[MapRequestPayload] ClientInput $input): JsonResponse
    {
        $client = $this->find($user, $id);
        $website = Website::host($input->website);
        if ($website === false) {
            return $this->json(['error' => 'that website does not look right, use something like acme.com'], 422);
        }

        $this->apply($client, $input, $website);
        $this->em->flush();

        return $this->json($this->toJson($client));
    }

    #[Route('/{id}', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $client = $this->find($user, $id);
        if ($this->em->getRepository(Invoice::class)->count(['client' => $client]) > 0) {
            return $this->json(['error' => 'this client has invoices, delete those first'], 409);
        }

        $this->em->remove($client);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    private function find(User $user, int $id): Client
    {
        return $this->em->getRepository(Client::class)->findOneBy(['id' => $id, 'owner' => $user])
            ?? throw $this->createNotFoundException();
    }

    private function apply(Client $client, ClientInput $input, ?string $website): void
    {
        $client->setName(trim($input->name));
        $client->setEmail($input->email ? mb_strtolower(trim($input->email)) : null);
        $client->setWebsite($website);
        $client->setExtras(Website::clean($input->location), Website::clean($input->taxId), Website::clean($input->phone));
        $client->setRate($input->rate);
        $client->setTermsDays($input->termsDays);
        $client->setCurrency($input->currency);
    }

    private function toJson(Client $client): array
    {
        return [
            'id' => $client->getId(),
            'name' => $client->getName(),
            'email' => $client->getEmail(),
            'website' => $client->getWebsite(),
            'location' => $client->getLocation(),
            'taxId' => $client->getTaxId(),
            'phone' => $client->getPhone(),
            'termsDays' => $client->getTermsDays(),
            'rate' => $client->getRate(),
            'currency' => $client->getCurrency(),
        ];
    }
}
