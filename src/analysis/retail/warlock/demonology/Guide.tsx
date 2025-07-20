import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from './CombatLogParser';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import CooldownSubsection from './modules/guide/CooldownsSubsection';
import ResourceUsage from './modules/guide/ResourceUsage';
import DefensivesGuide from '../shared/Defensives';
import TALENTS from 'common/TALENTS/warlock';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <CoreSection modules={modules} events={events} info={info} />
      <CooldownSection modules={modules} events={events} info={info} />
      <TalentSection modules={modules} events={events} info={info} />
      <DefensivesGuide modules={modules} events={events} info={info} />
      <ResourceUsage modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

function CoreSection({ modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title="Core">
      {modules.alwaysBeCasting.guideSubsection}
    </Section>
  );
}

function CooldownSection({ modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title="Cooldowns">
      <CooldownSubsection />
      {modules.summonDemonicTyrant.guideSubsection}
    </Section>
  );
}

function TalentSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title="Talents">
      {info.combatant.hasTalent(TALENTS.DOOM_TALENT) && modules.doom.guideSubsection}
    </Section>
  );
}
