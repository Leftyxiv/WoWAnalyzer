import SPELLS from 'common/SPELLS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Options } from 'parser/core/Analyzer';
import { CastEvent, ResourceChangeEvent } from 'parser/core/Events';
import ResourceTracker from 'parser/shared/modules/resources/resourcetracker/ResourceTracker';

class SoulShardTracker extends ResourceTracker {
  constructor(options: Options) {
    super(options);
    this.resource = RESOURCE_TYPES.SOUL_SHARDS;
  }

  onEnergize(event: ResourceChangeEvent) {
    const classResources = this.getResource(event);
    if (classResources) {
      classResources.amount /= 10;
      classResources.max /= 10;
    }
    super.onEnergize(event);
  }

  onCast(event: CastEvent) {
    const classResources = this.getResource(event);
    if (classResources) {
      classResources.amount /= 10;
      classResources.cost = classResources.cost ? classResources.cost / 10 : 0;
      classResources.max /= 10;
      super.onCast(event);
    }
  }

  getAdjustedCost(event: CastEvent) {
    let cost = super.getAdjustedCost(event) ?? 0;
    // Demonic Calling (T30 talent) proc reduces the cost of next Call Dreadstalkers by 1 shard
    if (
      event.ability.guid === SPELLS.CALL_DREADSTALKERS.id &&
      this.selectedCombatant.hasBuff(SPELLS.DEMONIC_CALLING_BUFF.id)
    ) {
      cost -= 1;
    }
    return cost;
  }

  getAdjustedGain(event: ResourceChangeEvent): { gain: number; waste: number } {
    const { gain, waste } = super.getAdjustedGain(event);
    return {
      gain: gain / 10,
      waste: waste / 10,
    };
  }
}

export default SoulShardTracker;
