<?php

namespace App\Controller;

use App\Dto\ProfileInput;
use App\Entity\User;
use App\Rates;
use App\Website;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api')]
final class ProfileController extends AbstractController
{
    #[Route('/profile', methods: ['GET'])]
    public function show(#[CurrentUser] User $user): JsonResponse
    {
        return $this->json($user->profile() + $user->settings());
    }

    #[Route('/profile', methods: ['PUT'])]
    public function update(#[CurrentUser] User $user, #[MapRequestPayload] ProfileInput $input, EntityManagerInterface $em): JsonResponse
    {
        $website = Website::host($input->website);
        if ($website === false) {
            return $this->json(['error' => 'that website does not look right, use something like acme.com'], 422);
        }

        $payLink = Website::clean($input->payLink);
        if ($payLink !== null && !$this->safeLink($payLink)) {
            return $this->json(['error' => 'the pay link has to be a full https address like https://paypal.me/you'], 422);
        }

        $user->setProfile(
            Website::clean($input->businessName),
            $input->contactEmail ? mb_strtolower(trim($input->contactEmail)) : null,
            Website::clean($input->location),
            Website::clean($input->taxId),
            $website,
            Website::clean($input->paymentDetails),
        );
        $user->setSettings(trim($input->invoicePrefix), trim($input->quotePrefix), $input->homeCurrency, $input->robuxValue, $payLink);
        $em->flush();

        return $this->json($user->profile() + $user->settings());
    }

    #[Route('/rates', methods: ['GET'])]
    public function rates(#[CurrentUser] User $user, Rates $rates): JsonResponse
    {
        $data = $rates->usdRates();
        if (!$data) {
            return $this->json(['error' => 'exchange rates are not available right now'], 503);
        }

        return $this->json($data + ['robuxValue' => $user->settings()['robuxValue']]);
    }

    private function safeLink(string $link): bool
    {
        if (strlen($link) > 300 || preg_match('/\s/', $link)) {
            return false;
        }

        $parts = parse_url($link);
        if (($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        return is_string(Website::host('https://'.($parts['host'] ?? '')));
    }
}
