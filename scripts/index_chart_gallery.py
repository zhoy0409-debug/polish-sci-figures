"""Index reference metadata without executing or redistributing supplied R/images."""
import hashlib,json,re,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LINKS={
 'A02':'bar_raw_points','A04':'raw_points_estimate_ci','A06':'box_raw_points','A08':'violin_raw_points','A12':'raincloud','A16':'estimation_graphic','A18':'paired_trajectories','A19':'paired_estimation','A20':'superplot','A21':'grouped_observations','A26':'ridgeline','A29':'group_ecdf',
 'B02':'relationship_regression','B03':'prediction_intervals','B08':'relationship_joint_distribution','B12':'hexbin_density','B14':'bland_altman','B16':'correlation_values','B17':'correlation_circles',
 'C07':'timecourse_trajectories','C19':'paired_dumbbell','C22':'swimmer','D03':'composition_ring','D04':'composition_waffle','D06':'composition_stacked','D15':'ternary_composition',
 'E01':'kaplan_meier','E03':'kaplan_meier_risk_table','F01':'volcano','F03':'ma_expression','F04':'matrix_heatmap','F06':'variance_scree','F08':'embedding_groups','F10':'enrichment_lollipop','F11':'enrichment_bubble','F12':'gsea_tracks','F13':'genome_manhattan','F14':'pvalue_quantiles','F16':'upset_intersections','G01':'forest_intervals','H20':'study_gantt'}
ROC='roc roc_smooth roc_auc_fill roc_threshold_points roc_threshold_color roc_threshold_labels roc_youden roc_pointwise_band roc_cutoff_ci roc_cost roc roc_direct_labels roc_training_validation roc_subgroups roc_cv roc_bootstrap_curves roc_auc_intervals roc_partial roc_convex roc_log_fpr roc_probit roc_confusion roc_score_distribution roc_two_graph roc_time roc_multi roc_sroc'.split()
LINKS.update({f'I{i+1:02}':name for i,name in enumerate(ROC)})
def main(path):
    path=Path(path);records=[]
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            base=Path(name).name;match=re.match(r'f([1-8])_',base)
            if match:key=chr(64+int(match[1]))
            elif base=='roc_gallery.R':key='I'
            else:continue
            text=z.read(name).decode('utf-8-sig');titles=re.findall(r'^add\("([^"\n]+)"',text,re.M)
            for i,title in enumerate(titles):
                ident=f'{key}{i+1:02}';records.append({'id':ident,'source_title':title,'source_script':base,'related_renderer':LINKS.get(ident),'status':'related-renderer' if ident in LINKS else 'design-review-pending','note':'Relationship only; original statistical claims, numerical results and artwork are not imported.'})
    assert len(records)==187
    output={'source_archive':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'items':sorted(records,key=lambda r:r['id'])}
    (ROOT/'skills/polish-sci-figures/references/chart-gallery-index.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Indexed {len(records)} reference designs; no source images or executable code bundled')
if __name__=='__main__':main(sys.argv[1])
