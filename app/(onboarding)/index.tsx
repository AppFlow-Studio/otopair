// app/(onboarding)/index.tsx
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export default function OnboardingScreen() {
    return <OnboardingFlow initialStep="welcome" />;
}