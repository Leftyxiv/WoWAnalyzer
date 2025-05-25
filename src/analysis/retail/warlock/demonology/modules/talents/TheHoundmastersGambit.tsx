import { formatPercentage, formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import Events, { DamageEvent } from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

import DemoPets from '../pets/DemoPets';
import PETS from '../pets/PETS';

class TheHoundmastersGambit extends Analyzer {
  static dependencies = {
    demoPets: DemoPets,
  };
  demoPets!: DemoPets;

  dreadstalkerDamageWhileVilefiendActive = 0;
  totalDreadstalkerDamage = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.THE_HOUNDMASTERS_GAMBIT_TALENT);

    if (this.active) {
      this.addEventListener(
        Events.damage.by(SELECTED_PLAYER_PET).spell(SPELLS.DREADBITE),
        this.onDreadstalkerDamage,
      );
    }
  }

  onDreadstalkerDamage(event: DamageEvent) {
    const damage = event.amount + (event.absorbed || 0);
    this.totalDreadstalkerDamage += damage;

    // Check if vilefiend is active at this timestamp
    const activePets = this.demoPets.timeline.getPetsAtTimestamp(event.timestamp);
    const vilefiendActive = activePets.some(
      (pet) =>
        pet.guid === PETS.VILEFIEND.guid ||
        pet.guid === PETS.CHARHOUND.guid ||
        pet.guid === PETS.GLOOMHOUND.guid,
    );

    if (vilefiendActive) {
      this.dreadstalkerDamageWhileVilefiendActive += damage;
    }
  }

  get vilefiendUptime() {
    let totalUptime = 0;
    const timeline = this.demoPets.timeline.timeline;

    for (const pet of timeline) {
      if (
        pet.guid === PETS.VILEFIEND.guid ||
        pet.guid === PETS.CHARHOUND.guid ||
        pet.guid === PETS.GLOOMHOUND.guid
      ) {
        const despawnTime = pet.realDespawn || pet.expectedDespawn;
        totalUptime += despawnTime - pet.spawn;
      }
    }

    return totalUptime / this.owner.fightDuration;
  }

  get empoweredDamagePercentage() {
    if (this.totalDreadstalkerDamage === 0) return 0;
    return this.dreadstalkerDamageWhileVilefiendActive / this.totalDreadstalkerDamage;
  }

  get activeVilefiendVariant() {
    const timeline = this.demoPets.timeline.timeline;

    for (const pet of timeline) {
      if (pet.guid === PETS.VILEFIEND.guid) {
        return 'Vilefiend';
      } else if (pet.guid === PETS.CHARHOUND.guid) {
        return 'Charhound';
      } else if (pet.guid === PETS.GLOOMHOUND.guid) {
        return 'Gloomhound';
      }
    }

    return 'None';
  }

  statistic() {
    const variant = this.activeVilefiendVariant;

    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={
          <>
            <strong>Empowered Dreadstalker Analysis:</strong>
            <br />
            {formatThousands(this.dreadstalkerDamageWhileVilefiendActive)} damage from Dreadstalkers
            while {this.activeVilefiendVariant} was active
            <br />
            {formatThousands(this.totalDreadstalkerDamage)} total Dreadstalker damage
            <br />
            <br />
            <strong>Performance Metrics:</strong>
            <br />
            Vilefiend uptime: {formatPercentage(this.vilefiendUptime)}%
            <br />
            Empowered damage: {formatPercentage(this.empoweredDamagePercentage)}% of total
            Dreadstalker damage
            <br />
            <br />
            <strong>Vilefiend variant used:</strong> {variant}
            <br />
            <br />
            <SpellLink spell={TALENTS.THE_HOUNDMASTERS_GAMBIT_TALENT} /> empowers your Dreadstalkers
            when any Vilefiend variant is active. Higher uptime and better timing coordination will
            increase the percentage of empowered damage.
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS.THE_HOUNDMASTERS_GAMBIT_TALENT}>
          <ItemDamageDone amount={this.dreadstalkerDamageWhileVilefiendActive} />
          <br />
          <small>
            {formatPercentage(this.empoweredDamagePercentage)}% empowered •{' '}
            {formatPercentage(this.vilefiendUptime)}% uptime
          </small>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default TheHoundmastersGambit;
