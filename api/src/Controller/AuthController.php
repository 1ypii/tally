<?php

namespace App\Controller;

use App\Demo\DemoAccounts;
use App\Dto\RegisterInput;
use App\Entity\Category;
use App\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
final class AuthController extends AbstractController
{
    #[Route('/login', name: 'api_login', methods: ['POST'])]
    public function login(): never
    {
        throw new \LogicException('login is handled by the firewall');
    }

    #[Route('/logout', methods: ['POST'])]
    public function logout(Security $security): JsonResponse
    {
        if ($this->getUser()) {
            $security->logout(false);
        }

        return new JsonResponse(null, 204);
    }

    #[Route('/changes', methods: ['GET'])]
    public function changes(Connection $db): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'not signed in'], 401);
        }

        $version = $db->fetchOne('SELECT data_version FROM users WHERE id = ?', [$user->getId()]);
        $res = $this->json(['version' => (int) $version]);
        $res->headers->set('Cache-Control', 'no-store');

        return $res;
    }

    #[Route('/me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->getUser();

        return $this->json($user instanceof User ? $user->summary() : null);
    }

    #[Route('/register', methods: ['POST'])]
    public function register(
        #[MapRequestPayload] RegisterInput $input,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
        Security $security,
    ): JsonResponse {
        $email = mb_strtolower(trim($input->email));
        if ($em->getRepository(User::class)->findOneBy(['email' => $email])) {
            return $this->json(['error' => 'that email is already registered'], 409);
        }

        $user = new User($email);
        $user->setPassword($hasher->hashPassword($user, $input->password));
        $em->persist($user);
        foreach (Category::defaults as $name) {
            $em->persist(new Category($user, $name));
        }
        $em->flush();

        $security->login($user, 'json_login', 'main');

        return $this->json($user->summary(), 201);
    }

    #[Route('/demo', methods: ['POST'])]
    public function demo(DemoAccounts $accounts, Security $security): JsonResponse
    {
        $user = $accounts->create();
        if (!$user) {
            return $this->json(['error' => 'demo is busy right now, try again later'], 503);
        }

        $security->login($user, 'json_login', 'main');

        return $this->json($user->summary(), 201);
    }
}
