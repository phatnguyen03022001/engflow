/* @lifecycle ACTIVE — SectionGraphBuilder: factory that produces DualGraph from dependency + similarity builders (TASK-060) */

import { DualGraph } from '../ir/types';
import { SectionRegistry } from '../registry/SectionRegistry';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { SimilarityGraphBuilder } from './SimilarityGraphBuilder';

export class SectionGraphBuilder {
  static async build(registry: SectionRegistry): Promise<DualGraph> {
    const depBuilder = new DependencyGraphBuilder(registry);
    const simBuilder = new SimilarityGraphBuilder(registry);

    const dependency = depBuilder.build();
    const similarity = simBuilder.build();

    return { dependency, similarity };
  }
}
