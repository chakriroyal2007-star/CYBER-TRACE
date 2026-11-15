import { forensicTracer } from '../tracing/tracer.mjs';

/**
 * Executes an initial shallow on-chain trace (max 2 hops) on a reporter-supplied public wallet.
 * Tags nodes and edges with strict provenance metadata:
 * - Seed wallet: USER_UPLOADED
 * - Traversed hops & exit candidates: REAL_PUBLIC_ONCHAIN
 */
export async function autoTracePublicWallet({ seedAddress, chain = 'Ethereum', amountINR = 100000 }) {
  if (!seedAddress) return null;

  try {
    const traceResult = await forensicTracer.trace(
      seedAddress,
      Number(amountINR) || 100000,
      new Date().toISOString(),
      { maxHops: 2, chain }
    );

    const cleanSeed = seedAddress.toLowerCase();

    // Attach strict provenance tags to nodes
    const nodesWithProvenance = (traceResult.nodes || []).map(node => {
      const isSeed = node.address && node.address.toLowerCase() === cleanSeed;
      return {
        ...node,
        provenance: isSeed ? 'USER_UPLOADED' : 'REAL_PUBLIC_ONCHAIN',
        sourceConfidence: isSeed ? 'CITIZEN_CLAIMED' : 'BLOCKCHAIN_OBSERVED',
        tag: isSeed ? 'Reported Suspect Seed' : (node.type === 'vasp' ? 'Actionable Exit Candidate' : 'On-Chain Hop')
      };
    });

    // Attach provenance tags to edges
    const edgesWithProvenance = (traceResult.edges || []).map(edge => ({
      ...edge,
      provenance: 'REAL_PUBLIC_ONCHAIN'
    }));

    const exitCandidates = nodesWithProvenance.filter(n => n.type === 'vasp' || n.entity);

    return {
      success: true,
      chain,
      seedAddress,
      maxHopsExecuted: 2,
      nodes: nodesWithProvenance,
      edges: edgesWithProvenance,
      exitCandidates,
      clusterCount: traceResult.clusters?.length || 0,
      provenanceSummary: {
        USER_UPLOADED: nodesWithProvenance.filter(n => n.provenance === 'USER_UPLOADED').length,
        REAL_PUBLIC_ONCHAIN: nodesWithProvenance.filter(n => n.provenance === 'REAL_PUBLIC_ONCHAIN').length
      }
    };
  } catch (error) {
    console.warn(`Auto-trace for ${seedAddress} degraded honestly:`, error.message);
    return {
      success: false,
      error: error.message,
      nodes: [
        {
          id: 'W-00',
          address: seedAddress,
          label: 'Reported Suspect Wallet',
          type: 'suspect',
          chain,
          provenance: 'USER_UPLOADED',
          sourceConfidence: 'CITIZEN_CLAIMED'
        }
      ],
      edges: [],
      exitCandidates: []
    };
  }
}
