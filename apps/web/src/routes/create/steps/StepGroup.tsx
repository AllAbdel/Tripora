import { Heart, User, Users, UsersRound } from 'lucide-react';
import type { GroupType } from '@tripora/core';
import { OptionCard } from '@/components/ui/OptionCard';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { useTripDraft } from '@/stores/tripDraft';

const GROUPS: { value: GroupType; label: string; description: string; icon: typeof User; participants: number }[] = [
  { value: 'solo', label: 'Seul', description: 'Un voyage rien qu’à moi', icon: User, participants: 1 },
  { value: 'couple', label: 'En couple', description: 'À deux', icon: Heart, participants: 2 },
  { value: 'friends', label: 'Entre amis', description: 'Le groupe décidera ensemble', icon: Users, participants: 4 },
  { value: 'family', label: 'En famille', description: 'Avec des envies très différentes', icon: UsersRound, participants: 4 },
];

export function StepGroup() {
  const { groupType, participants, patch } = useTripDraft();

  return (
    <div className="space-y-5">
      <div className="space-y-2.5" role="radiogroup" aria-label="Avec qui partez-vous ?">
        {GROUPS.map(({ value, label, description, icon: Icon, participants: suggested }) => (
          <OptionCard
            key={value}
            selected={groupType === value}
            onSelect={() => patch({ groupType: value, participants: suggested })}
            icon={<Icon className="size-5" aria-hidden />}
            title={label}
            description={description}
          />
        ))}
      </div>

      <NumberStepper
        label="Nombre de participants"
        value={participants}
        min={1}
        max={30}
        onChange={(value) =>
          patch({ participants: value, groupType: value === 1 ? 'solo' : groupType })
        }
      />
    </div>
  );
}
