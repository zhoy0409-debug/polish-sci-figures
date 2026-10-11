"""Reference coverage points to implemented data contracts, never source artwork."""
LEGACY_MAP={
1:'superplot',2:'compare_raincloud',3:'upset_intersections',4:'compare_gardner_altman',
5:'distribution_sina',7:'compare_cumming',8:'compare_strip_median',9:'bland_altman',
10:'meta_forest',12:'compare_cleveland',13:'volcano_labels',14:'survival_risk_counts',
15:'meta_funnel',16:'roc',17:'calibration_results',18:'decision_curve_results',
19:'clustered_matrix',20:'pca_loadings',21:'relation_residual_qq',22:'compare_notched_box',
23:'dose_response_result',24:'checkerboard_assay',25:'composition_mosaic',26:'flow_alluvial',
27:'correlation_values',28:'spline_effect_results',31:'time_supplied_fit',32:'time_kill',
33:'mic_distribution',34:'compare_paired_lines',35:'taxa_composition',36:'rarefaction_result',
37:'pcoa_spider',38:'phylogeny_traits',39:'mutation_lollipop',40:'enrichment_dots',
41:'competing_incidence',42:'compare_ridgeline',43:'response_waterfall',44:'composition_likert',
45:'genome_manhattan',46:'ma_expression',47:'antibiogram_matrix',48:'schoenfeld_results',
49:'precision_recall',50:'compare_violin',52:'gene_arrows',54:'hexbin_density',57:'gsea_tracks',
58:'singlecell_dots',59:'embedding_map',60:'ternary_composition',61:'composition_treemap',
63:'cooccurrence_network',65:'causal_dag',66:'study_flow',67:'time_rank_changes',
68:'time_epidemic',69:'time_calendar',70:'composition_pictogram',71:'rose_frequency',
73:'compare_ecdf',74:'time_individual_paths',79:'time_swimmer',80:'paired_dumbbell',
81:'compare_uncertainty',82:'compare_interaction',84:'coefficient_forest',85:'variance_scree',
86:'time_small_multiples',89:'relation_loess',90:'meta_cumulative',94:'plasmid_features',
102:'roc_two_graph'}

def write_coverage(root,modules,starters):
    import json
    path=root/'skills/polish-sci-figures/references/design-pattern-index.json'
    cards=json.loads(path.read_text(encoding='utf-8'))
    mapping={**LEGACY_MAP,**{number:key for module in modules for number,key in getattr(module,'REFERENCE_MAP',{}).items()}}
    for card in cards:
        number=card['number']
        if number in (6,11):
            card.update(status='design-system-guidance',feature='palette-editor',renderer=None)
            continue
        key=mapping[number]
        assert key in starters,(number,key)
        card.update(renderer=key,status='editable-original-template')
    path.write_text(json.dumps(cards,ensure_ascii=False,indent=2),encoding='utf-8')
