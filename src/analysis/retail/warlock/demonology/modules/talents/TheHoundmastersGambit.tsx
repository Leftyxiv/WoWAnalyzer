import { formatThousands } from 'common/format';
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
    // Check if vilefiend is active at this timestamp
    const activePets = this.demoPets.timeline.getPetsAtTimestamp(event.timestamp);
    const vilefiendActive = activePets.some(
      (pet) =>
        pet.guid === PETS.VILEFIEND.guid ||
        pet.guid === PETS.CHARHOUND.guid ||
        pet.guid === PETS.GLOOMHOUND.guid,
    );

    if (vilefiendActive) {
      this.dreadstalkerDamageWhileVilefiendActive += event.amount + (event.absorbed || 0);
    }
  }

  statistic() {
    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={
          <>
            {formatThousands(this.dreadstalkerDamageWhileVilefiendActive)} damage from Dreadstalkers
            while Vilefiend was active.
            <br />
            <SpellLink spell={TALENTS.THE_HOUNDMASTERS_GAMBIT_TALENT} /> empowers your Dreadstalkers
            when Vilefiend is active.
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS.THE_HOUNDMASTERS_GAMBIT_TALENT}>
          <ItemDamageDone amount={this.dreadstalkerDamageWhileVilefiendActive} />
          <br />
          <small>Dreadstalker damage with Vilefiend</small>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default TheHoundmastersGambit;
