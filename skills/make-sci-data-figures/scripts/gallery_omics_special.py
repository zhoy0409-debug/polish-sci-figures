"""Original editable omics and experimental-design templates.

Chart families are inspired by a reference catalogue; the implementation, fixtures,
and artwork are original. Declared analysis outputs stay distinct from inference.
"""
from __future__ import annotations

import textwrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from gallery_fonts import font_families
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.patches import Circle, Rectangle, FancyArrowPatch, Wedge, PathPatch
from matplotlib.path import Path
from matplotlib.lines import Line2D
from scipy.cluster.hierarchy import linkage, dendrogram, leaves_list
from scipy.spatial.distance import pdist
from scipy.stats import gaussian_kde


CONTRACTS = {
 'volcano_plain': ('差异分析火山图','Differential-expression volcano','omics','feature log2fc adjusted_p significant','log2fc adjusted_p significant'),
 'volcano_labels': ('基因标注火山图','Labelled volcano','omics','feature log2fc adjusted_p significant label','log2fc adjusted_p significant label'),
 'clustered_matrix': ('层次聚类热图','Hierarchically clustered heatmap','omics','feature sample value','value'),
 'pca_ellipse': ('PCA 得分与已计算椭圆','PCA scores and supplied ellipses','relationship','id group role x y','x y'),
 'pcoa_spider': ('PCoA 得分与组中心','PCoA scores and group centroids','relationship','id group x y','x y'),
 'embedding_map': ('UMAP / t-SNE 坐标图','UMAP / t-SNE coordinates','relationship','id group x y','x y'),
 'singlecell_dots': ('单细胞表达点阵','Single-cell expression dots','omics','gene cluster mean_expression percent_expressing','mean_expression percent_expressing'),
 'enrichment_bars': ('通路富集条形图','Pathway enrichment bars','omics','pathway adjusted_p','adjusted_p'),
 'enrichment_dots': ('通路富集气泡图','Pathway enrichment bubbles','omics','pathway gene_ratio adjusted_p count','gene_ratio adjusted_p count'),
 'venn_membership': ('双集合维恩图','Two-set Venn diagram','omics','sample set',''),
 'mutation_lollipop': ('蛋白突变棒棒糖图','Protein mutation lollipops','omics','mutation position count protein_length','position count protein_length'),
 'lefse_scores': ('LEfSe 判别得分','LEfSe discriminant scores','omics','feature group lda_score','lda_score'),
 'cooccurrence_network': ('共现网络','Co-occurrence network','omics','source target weight','weight'),
 'oncoprint_matrix': ('突变事件矩阵','Mutation event matrix','omics','sample gene alteration',''),
 'dose_response_result': ('剂量反应与拟合结果','Dose response and supplied fit','longitudinal','series role concentration response','concentration response'),
 'time_kill': ('时间杀菌轨迹','Time-kill trajectories','longitudinal','group replicate time log10_cfu','time log10_cfu'),
 'mic_distribution': ('MIC 分布与参考阈值','MIC distribution and reference threshold','distribution','mic count cutoff','mic count cutoff'),
 'checkerboard_assay': ('联合药敏棋盘图','Checkerboard assay','matrix','dose_a dose_b inhibition','dose_a dose_b inhibition'),
 'isobologram': ('联合用药等效线图','Combination isobologram','relationship','combination dose_a dose_b single_a single_b','dose_a dose_b single_a single_b'),
 'zone_diameters': ('抑菌圈与参考折点','Zone diameters and supplied breakpoint','distribution','isolate drug diameter breakpoint','diameter breakpoint'),
 'antibiogram_matrix': ('累积药敏矩阵','Cumulative antibiogram','matrix','organism drug tested susceptible','tested susceptible'),
 'rarefaction_result': ('稀释曲线结果','Supplied rarefaction curves','longitudinal','sample depth richness','depth richness'),
 'taxa_composition': ('分类群相对丰度','Taxon relative abundance','matrix','sample taxon abundance','abundance'),
 'alpha_diversity': ('α 多样性与原始点','Alpha diversity observations','distribution','sample group diversity','diversity'),
 'phylogeny_traits': ('进化树与性状矩阵','Supplied phylogeny and trait matrix','omics','role id parent branch_length trait value','branch_length value'),
 'gene_arrows': ('基因方向比较图','Gene direction comparison','omics','track gene start end strand','start end strand'),
 'plasmid_features': ('环形质粒特征图','Circular plasmid features','omics','feature start end strand genome_length','start end strand genome_length'),
 'protein_domains': ('蛋白结构域与突变','Protein domains and mutations','omics','role label start end count protein_length','start end count protein_length'),
 'flow_alluvial': ('双阶段流向图','Two-stage alluvial flow','matrix','source target value','value'),
 'rose_frequency': ('方向频数玫瑰图','Directional frequency rose','matrix','direction count','direction count'),
 'radar_profile': ('共同量纲雷达图','Common-scale radar profile','matrix','group measure value scale_max','value scale_max'),
 'causal_dag': ('因果假设有向无环图','Causal-assumption DAG','relationship','source target',''),
 'study_timeline': ('研究事件时间轴','Study-event timeline','longitudinal','event phase time','time'),
}

NOTES = {
 'volcano_plain': ('输入已有差异分析结果及预先定义的显著性标记；不自动更改阈值。','Supply differential-analysis results and prespecified significance flags; thresholds are not inferred.'),
 'volcano_labels': ('在差异分析结果上标出指定基因；label 为 0 或 1，最多标注 8 个。','Label specified genes in supplied differential results; label is 0 or 1, with at most eight labels.'),
 'clustered_matrix': ('完整特征×样本数值矩阵；使用欧氏距离和平均连接排序，不自动标准化数据。','Complete feature-by-sample matrix; Euclidean distance and average linkage, without automatic data standardization.'),
 'pca_ellipse': ('输入得分和已计算椭圆边界；role 为 point 或 boundary，椭圆的置信水平和含义由原分析定义。','Supply scores and calculated ellipse boundaries; role is point or boundary. The source analysis defines confidence level and interpretation.'),
 'pcoa_spider': ('输入已计算的 PCoA 坐标；连线指向组内算术中心，不代表置信区间或显著性。','Supplied PCoA coordinates; segments connect observations to arithmetic group centroids, not confidence intervals or significance.'),
 'embedding_map': ('输入已计算的二维嵌入坐标；保留坐标，不以二维组间距离代替检验。','Supply calculated two-dimensional embedding coordinates; distances do not substitute for statistical tests.'),
 'singlecell_dots': ('颜色为已有平均表达值，圆面积为表达细胞比例；百分比范围为 0–100。','Colour encodes supplied mean expression; circle area encodes percent expressing, from 0 to 100.'),
 'enrichment_bars': ('输入富集分析校正 P 值；条长为 −log₁₀ 校正 P，不自动推断富集。','Supply adjusted enrichment P values; length is −log₁₀ adjusted P, with no inferred enrichment analysis.'),
 'enrichment_dots': ('基因比例、命中数量和校正 P 值分别提供；位置、面积和颜色对应不同量。','Supply gene ratio, hit count, and adjusted P; position, area, and colour encode distinct quantities.'),
 'venn_membership': ('输入样本集合成员关系；显示精确交集计数，圆面积不代表样本数量。','Sample-set membership with exact intersection counts; circle area is not proportional to count.'),
 'mutation_lollipop': ('蛋白位置、突变次数和蛋白长度；横轴以氨基酸位置表示。','Amino-acid position, mutation count, and protein length; the position axis is in amino acids.'),
 'lefse_scores': ('输入已完成 LEfSe 分析的判别得分及富集组别；不从丰度表直接生成 LDA 得分。','Supply LEfSe discriminant scores and enriched groups; LDA scores are not inferred from an abundance table.'),
 'cooccurrence_network': ('输入筛选后的关联边及有符号权重；实线为正、虚线为负，关联不等同于因果。','Supply selected association edges and signed weights; solid positive and dashed negative edges do not imply causality.'),
 'oncoprint_matrix': ('每个样本与基因至少一条记录；无事件显式填 None，多事件可分行记录。','Every sample-gene pair needs a record; use None for no event, and separate rows for multiple events.'),
 'dose_response_result': ('role 为 observed 或 fitted；输入正浓度及已计算拟合曲线，不自动生成 IC₅₀。','Role is observed or fitted; supply positive concentrations and calculated fitted responses. IC₅₀ is not inferred.'),
 'time_kill': ('输入各生物重复的时间与 log₁₀ CFU；细线为重复，粗线为组均值。','Time and log₁₀ CFU per biological replicate; thin replicate lines and bold group means.'),
 'mic_distribution': ('输入 MIC 频数及已确认参考阈值；阈值由菌种、方法与标准决定。','Supply MIC frequencies and a confirmed reference threshold appropriate to organism, method, and standard.'),
 'checkerboard_assay': ('输入两药实际浓度和抑制比例 0–1；不由颜色直接判定协同作用。','Supply actual drug concentrations and inhibition fractions from 0 to 1; colour alone does not establish synergy.'),
 'isobologram': ('两药剂量分别除以各自单药等效剂量；虚线为相加参考，不自动给出协同显著性。','Doses are normalized to each single-drug equivalent dose; the dashed line is an additive reference, not a synergy significance test.'),
 'zone_diameters': ('输入抑菌圈直径及适用药物的已确认折点，单位统一为 mm。','Supply inhibition-zone diameters and confirmed drug-specific breakpoints, both in mm.'),
 'antibiogram_matrix': ('输入检测数和敏感数；百分比由计数计算，格内同时显示样本量。','Supply numbers tested and susceptible; percentages are computed from counts, and cells include sample size.'),
 'rarefaction_result': ('输入已计算的测序深度与丰富度结果；本图不重新抽样估计。','Supply calculated sequencing-depth and richness results; the display does not perform resampling.'),
 'taxa_composition': ('输入非负丰度，在每个样本内归一化；缺失的分类群须显式填写 0。','Nonnegative abundances normalized within each sample; absent taxa must be explicit zeros.'),
 'alpha_diversity': ('输入每个独立样本已计算的同一种 α 多样性指标，保留全部观测。','Supply one consistently defined alpha-diversity measure per independent sample; all observations are retained.'),
 'phylogeny_traits': ('role 为 node 或 trait；输入树的父子关系和非负枝长，性状值为 0 或 1，不重建系统发育。','Role is node or trait; supply parent-child relationships, nonnegative branch lengths, and binary traits. Phylogeny is not reconstructed.'),
 'gene_arrows': ('输入共同坐标系下的基因起止位置与链方向 ±1；箭头长度保留真实比例。','Supply gene coordinates on a common scale and strand ±1; arrow lengths preserve genomic proportions.'),
 'plasmid_features': ('输入环状序列长度、特征位置与链方向；跨原点特征可令 end 小于 start。','Supply circular sequence length, feature positions, and strand; end may be below start for an origin-crossing feature.'),
 'protein_domains': ('role 为 domain 或 mutation；结构域输入起止位置，突变使用相同 start 与 end。','Role is domain or mutation; domains have start/end positions, while mutation start equals end.'),
 'flow_alluvial': ('输入两个阶段间非负流量；每条带宽保留数量，节点总量由流量求和。','Supply nonnegative two-stage flows; ribbon widths preserve quantities and node totals are their sums.'),
 'rose_frequency': ('方向为角度 0–360，等宽分箱；扇形面积与频数成正比。','Directions in degrees with equally spaced bins; wedge area is proportional to frequency.'),
 'radar_profile': ('各指标必须有共同且有意义的 0–scale_max 量纲；不自动标准化混合单位。','Measures must share a meaningful zero-to-scale_max scale; mixed units are not silently normalized.'),
 'causal_dag': ('输入研究设计提出的因果假设；拒绝循环，连线不代表从数据证实的因果。','Supply causal assumptions from study design; cycles are rejected and edges are not data-proven causation.'),
 'study_timeline': ('输入研究事件、阶段与同单位时间；标签交错放置，保留实际时间间隔。','Supply events, phases, and time in consistent units; staggered labels preserve actual time intervals.'),
}

SOURCE_MAP = dict(zip([f'F{i:02}' for i in range(1,21)], [
 'volcano_plain','volcano_labels','ma_expression','clustered_matrix','pca_ellipse','variance_scree','pcoa_spider','embedding_map','singlecell_dots','enrichment_bars','enrichment_dots','gsea_tracks','genome_manhattan','pvalue_quantiles','venn_membership','upset_intersections','mutation_lollipop','lefse_scores','cooccurrence_network','oncoprint_matrix']))
SOURCE_MAP.update(dict(zip([f'H{i:02}' for i in range(1,21)], [
 'dose_response_result','time_kill','mic_distribution','checkerboard_assay','isobologram','zone_diameters','antibiogram_matrix','rarefaction_result','taxa_composition','alpha_diversity','phylogeny_traits','gene_arrows','plasmid_features','protein_domains','flow_alluvial','rose_frequency','radar_profile','causal_dag','study_timeline','study_gantt'])))
PRESERVE_ASPECT = {'venn_membership','plasmid_features','rose_frequency','radar_profile','pca_ellipse','pcoa_spider','embedding_map','cooccurrence_network','causal_dag'}
COMPATIBLE_GROUPS = [{'volcano_plain','volcano_labels'}, {'enrichment_bars','enrichment_dots'}]
PALETTE = ['#476f9c','#cb6476','#97adc5','#c09b58','#796c94','#9a8b80']


def _order(series):
    return list(dict.fromkeys(series.astype(str)))


def _wrap(value, width=14):
    return '\n'.join(textwrap.wrap(str(value),width=width,break_long_words=True))


def _tree(d):
    nodes=d[d.role=='node']; ids=set(nodes.id); parent=dict(zip(nodes.id,nodes.parent))
    roots=[n for n,p in parent.items() if p=='ROOT']
    if len(roots)!=1 or not set(parent.values())<=(ids|{'ROOT'}): raise ValueError('Tree needs one ROOT parent and known node IDs')
    for n in ids:
        seen=set();cur=n
        while cur!='ROOT':
            if cur in seen: raise ValueError('Tree contains a cycle')
            seen.add(cur);cur=parent[cur]
    children={n:[v for v,p in parent.items() if p==n] for n in ids}
    leaves=[n for n in nodes.id if not children[n]]
    return nodes,parent,children,roots[0],leaves


def _dag_levels(d):
    nodes=_order(pd.concat([d.source,d.target])); levels={}; remain=set(nodes)
    while remain:
        ready=[n for n in nodes if n in remain and all(s in levels for s in d.loc[d.target==n,'source'])]
        if not ready: raise ValueError('A DAG cannot contain a cycle')
        for n in ready: levels[n]=max([levels[s]+1 for s in d.loc[d.target==n,'source']]+[0])
        remain-=set(ready)
    return nodes,levels


def validate(data, view):
    if view not in CONTRACTS: raise ValueError('Unknown omics/special template')
    fields=CONTRACTS[view][3].split(); nums=CONTRACTS[view][4].split()
    if not set(fields)<=set(data): raise ValueError('Required columns: '+', '.join(fields))
    d=data.copy(deep=True)
    if d.empty or d[fields].isna().any().any(): raise ValueError('Required values must be present')
    for c in nums:
        d[c]=pd.to_numeric(d[c],errors='raise')
        if not np.isfinite(d[c]).all(): raise ValueError(c+' must be finite')
    for c in set(fields)-set(nums):
        d[c]=d[c].astype(str)
        if d[c].str.strip().eq('').any(): raise ValueError(c+' must be nonempty')
    keys={
      'volcano_plain':['feature'],'volcano_labels':['feature'],'clustered_matrix':['feature','sample'],
      'pca_ellipse':['group','role','id'],'pcoa_spider':['id'],'embedding_map':['id'],
      'singlecell_dots':['gene','cluster'],'enrichment_bars':['pathway'],'enrichment_dots':['pathway'],
      'venn_membership':['sample','set'],'mutation_lollipop':['mutation'],'lefse_scores':['feature'],
      'cooccurrence_network':['source','target'],'oncoprint_matrix':['sample','gene','alteration'],
      'time_kill':['group','replicate','time'],
      'mic_distribution':['mic'],'checkerboard_assay':['dose_a','dose_b'],'isobologram':['combination'],
      'zone_diameters':['isolate','drug'],'antibiogram_matrix':['organism','drug'],
      'rarefaction_result':['sample','depth'],'taxa_composition':['sample','taxon'],'alpha_diversity':['sample'],
      'gene_arrows':['track','gene'],'plasmid_features':['feature'],'protein_domains':['role','label'],
      'flow_alluvial':['source','target'],'rose_frequency':['direction'],'radar_profile':['group','measure'],
      'causal_dag':['source','target'],'study_timeline':['event']}.get(view)
    if keys and d.duplicated(keys).any(): raise ValueError('Duplicate keys: '+', '.join(keys))
    for c in ['adjusted_p']:
        if c in fields and not ((d[c]>0)&(d[c]<=1)).all(): raise ValueError(c+' must be in (0, 1]')
    if 'significant' in fields and not d.significant.isin([0,1]).all(): raise ValueError('significant must be 0 or 1')
    if view=='volcano_labels' and (not d.label.isin([0,1]).all() or d.label.sum()>8): raise ValueError('label must be 0 or 1, with at most eight labels')
    for c in ['count','abundance','branch_length','diameter','diversity','richness','depth','inhibition','mean_expression','gene_ratio','percent_expressing','position']:
        if c in fields and (d[c]<0).any(): raise ValueError(c+' cannot be negative')
    for c in ['count','tested','susceptible']:
        if c in fields and not np.equal(d[c],np.floor(d[c])).all(): raise ValueError(c+' must contain counts')
    if 'gene_ratio' in fields and (d.gene_ratio>1).any(): raise ValueError('gene_ratio must be in [0, 1]')
    if 'percent_expressing' in fields and (d.percent_expressing>100).any(): raise ValueError('Percent expressing must be in [0, 100]')
    limits={'group':6,'series':4,'pathway':12,'drug':8,'organism':10,'taxon':8,'track':8,'measure':10,'phase':6}
    for col,limit in limits.items():
        if col in fields and d[col].nunique()>limit: raise ValueError(f'{col}: use at most {limit} categories in one panel')
    if view=='clustered_matrix':
        m=d.pivot(index='feature',columns='sample',values='value')
        if m.isna().any().any() or min(m.shape)<2 or max(m.shape)>16: raise ValueError('Clustering needs a complete 2–16 by 2–16 matrix')
    if view=='pca_ellipse':
        if not d.role.isin(['point','boundary']).all(): raise ValueError('role must be point or boundary')
        for _,g in d.groupby('group'):
            if len(g[g.role=='point'])<3 or len(g[g.role=='boundary'])<12: raise ValueError('Each group needs at least three scores and twelve ordered boundary coordinates')
            b=g[g.role=='boundary'][['x','y']].to_numpy()
            if not np.allclose(b[0],b[-1]):raise ValueError('An ellipse boundary must form an ordered closed path')
    if view in {'pcoa_spider','embedding_map'} and len(d)<3: raise ValueError('At least three coordinates are required')
    if view=='singlecell_dots':
        if d.gene.nunique()>12 or d.cluster.nunique()>10: raise ValueError('One dot map supports at most twelve genes and ten clusters')
        if len(d)!=d.gene.nunique()*d.cluster.nunique(): raise ValueError('Provide every gene-cluster pair; absent expression must be explicit zero')
    if view=='venn_membership' and d['set'].nunique()!=2: raise ValueError('This Venn template requires exactly two sets; use UpSet for additional sets')
    if view=='mutation_lollipop':
        if d.protein_length.nunique()!=1 or (d.protein_length<=0).any() or (d.position>d.protein_length).any() or len(d)>30: raise ValueError('Invalid protein positions, length, or more than thirty mutations')
    if view=='lefse_scores' and ((d.lda_score<0).any() or len(d)>14): raise ValueError('Use nonnegative LDA score magnitudes and at most fourteen features')
    if view=='cooccurrence_network':
        if (d.source==d.target).any() or len(set(d.source)|set(d.target))>16 or len(d)>45 or d.weight.eq(0).any(): raise ValueError('Use 2–16 nodes, nonzero weights, no self edges, and at most 45 edges')
        if d.apply(lambda r: tuple(sorted([r.source,r.target])),axis=1).duplicated().any(): raise ValueError('Undirected edges must be unique')
    if view=='oncoprint_matrix':
        if d.gene.nunique()>12 or d['sample'].nunique()>16 or d.alteration.nunique()>7: raise ValueError('OncoPrint supports at most twelve genes, sixteen samples and six alteration types')
        if d.groupby(['sample','gene']).ngroups!=d['sample'].nunique()*d.gene.nunique(): raise ValueError('Every sample-gene pair needs a record; use None for no event')
        if any(len(g)>1 and g.alteration.eq('None').any() for _,g in d.groupby(['sample','gene'])): raise ValueError('None cannot coexist with an alteration')
    if view=='dose_response_result':
        if not d.role.isin(['observed','fitted']).all() or (d.concentration<=0).any(): raise ValueError('Use positive concentrations and observed/fitted roles')
        for _,g in d.groupby('series'):
            if set(g.role)!={'observed','fitted'} or len(g[g.role=='fitted'])<3: raise ValueError('Each series needs observed values and at least three fitted coordinates')
            if g[g.role=='fitted'].concentration.duplicated().any():raise ValueError('Fitted concentrations must be unique; replicate observed concentrations are allowed')
    if view=='mic_distribution':
        if (d.mic<=0).any() or (d.cutoff<=0).any() or d.cutoff.nunique()!=1 or len(d)>16: raise ValueError('Use positive MIC values, one positive threshold, and at most sixteen bins')
    if view=='checkerboard_assay':
        if not d.inhibition.between(0,1).all() or (d[['dose_a','dose_b']]<0).any().any(): raise ValueError('Doses must be nonnegative and inhibition must lie in [0, 1]')
        if len(d)!=d.dose_a.nunique()*d.dose_b.nunique() or max(d.dose_a.nunique(),d.dose_b.nunique())>10: raise ValueError('Provide a complete checkerboard of at most ten by ten doses')
    if view=='isobologram' and ((d[['dose_a','dose_b']]<0).any().any() or (d[['single_a','single_b']]<=0).any().any()): raise ValueError('Combination doses must be nonnegative and single-drug equivalent doses positive')
    if view=='zone_diameters' and (d.groupby('drug').breakpoint.nunique().max()!=1 or (d.breakpoint<0).any()): raise ValueError('Supply one nonnegative breakpoint per drug')
    if view=='antibiogram_matrix':
        if (d.tested<=0).any() or (d.susceptible<0).any() or (d.susceptible>d.tested).any(): raise ValueError('Require 0 ≤ susceptible ≤ tested, with tested > 0')
        if len(d)!=d.organism.nunique()*d.drug.nunique(): raise ValueError('Provide a complete organism-drug matrix')
    if view=='rarefaction_result':
        if d['sample'].nunique()>8 or any(g.sort_values('depth').richness.diff().dropna().lt(0).any() for _,g in d.groupby('sample')): raise ValueError('Use at most eight nondecreasing rarefaction curves')
    if view=='taxa_composition':
        if d['sample'].nunique()>16 or len(d)!=d['sample'].nunique()*d.taxon.nunique() or d.groupby('sample').abundance.sum().le(0).any(): raise ValueError('Provide a complete sample-taxon table with positive totals and at most sixteen samples')
    if view=='alpha_diversity' and d.groupby('group').size().min()<3: raise ValueError('Each box needs at least three independent samples')
    if view=='phylogeny_traits':
        if not d.role.isin(['node','trait']).all(): raise ValueError('role must be node or trait')
        if d[d.role=='node'].id.duplicated().any() or d[d.role=='trait'].duplicated(['id','trait']).any(): raise ValueError('Duplicate node or trait key')
        nodes,parent,children,root,leaves=_tree(d);t=d[d.role=='trait']
        if not set(t.id)==set(leaves) or not t.value.isin([0,1]).all() or len(t)!=len(leaves)*t.trait.nunique() or len(leaves)>12 or t.trait.nunique()>8: raise ValueError('Supply a complete binary matrix for 2–12 tree tips and at most eight traits')
        if len(leaves)<2: raise ValueError('The tree needs at least two tips')
    if view=='gene_arrows' and ((d.start>=d.end).any() or not d.strand.isin([-1,1]).all() or len(d)>40): raise ValueError('Genes need start < end, strand ±1, and at most forty features')
    if view=='plasmid_features':
        if d.genome_length.nunique()!=1 or (d.genome_length<=0).any() or not d.strand.isin([-1,1]).all() or (d[['start','end']]<0).any().any() or (d.start>=d.genome_length).any() or (d.end>d.genome_length).any() or d.start.eq(d.end).any() or len(d)>12: raise ValueError('Invalid circular coordinates/strand; maximum twelve features')
    if view=='protein_domains':
        if not d.role.isin(['domain','mutation']).all() or d.protein_length.nunique()!=1 or (d.protein_length<=0).any() or (d.start<0).any() or (d.end>d.protein_length).any() or (d.end<d.start).any() or ((d.role=='mutation') & d.start.ne(d.end)).any() or len(d)>24: raise ValueError('Invalid domain/mutation coordinates; maximum twenty-four features')
    if view=='flow_alluvial' and ((d.value<=0).any() or max(d.source.nunique(),d.target.nunique())>6): raise ValueError('Flow values must be positive, with at most six nodes per stage')
    if view=='rose_frequency':
        angles=np.sort(d.direction.to_numpy())
        if not d.direction.between(0,360,inclusive='left').all() or len(d)<3 or len(d)>16 or not np.allclose(np.diff(np.r_[angles,angles[0]+360]),360/len(angles)): raise ValueError('Use 3–16 equally spaced direction bins in [0, 360)')
    if view=='radar_profile':
        if d.scale_max.nunique()!=1 or d.scale_max.iloc[0]<=0 or (d.value<0).any() or (d.value>d.scale_max).any() or not 3<=d.measure.nunique()<=10 or len(d)!=d.group.nunique()*d.measure.nunique() or d.group.nunique()>4: raise ValueError('Radar values need one shared positive scale and a complete 3–10 measure by at most four group matrix')
    if view=='causal_dag':
        nodes,levels=_dag_levels(d)
        if len(nodes)>12 or len(d)>24: raise ValueError('Use at most twelve DAG nodes and twenty-four edges')
    if view=='study_timeline' and len(d)>12: raise ValueError('One timeline supports at most twelve events')
    return d


def _axes(figsize):
    fig,ax=plt.subplots(figsize=figsize)
    fig.subplots_adjust(left=.19,right=.95,bottom=.21,top=.91)
    return fig,ax


def _finish(ax,x='',y=''):
    ax.set_xlabel(x,fontsize=9,labelpad=6);ax.set_ylabel(y,fontsize=9,labelpad=6)
    ax.tick_params(labelsize=8,length=3,width=.65,pad=3)
    ax.spines[['top','right']].set_visible(False)
    ax.spines[['left','bottom']].set_linewidth(.7)
    ax.margins(x=.06)


def _legend(fig,handles,labels,ncol=3):
    if not handles:return
    if len(handles)>ncol:fig.subplots_adjust(bottom=.29)
    fig.legend(handles,[_wrap(x,18) for x in labels],loc='lower center',bbox_to_anchor=(.5,.008),ncol=min(ncol,len(handles)),frameon=False,fontsize=8,handlelength=1.5,columnspacing=1.2,labelspacing=.4)


def _colorbar(fig,ax,mappable,label):
    fig.subplots_adjust(top=.78)
    cax=fig.add_axes([.28,.89,.52,.024])
    cb=fig.colorbar(mappable,cax=cax,orientation='horizontal')
    cb.set_label(label,fontsize=8,labelpad=2);cb.ax.xaxis.set_label_position('top');cb.ax.tick_params(labelsize=8,pad=2,length=2)
    cb.outline.set_visible(False)
    if cb.solids is not None:cb.solids.set_rasterized(False)
    return cb


def _matrix(ax,values,rows,cols,cmap,vmin=None,vmax=None,numbers=False,labels=True):
    rows=[_wrap(v,13) for v in rows];cols=[_wrap(v,10) for v in cols]
    h,w=values.shape
    mesh=ax.pcolormesh(np.arange(w+1)-.5,np.arange(h+1)-.5,values,cmap=cmap,vmin=vmin,vmax=vmax,edgecolor='white',lw=.7,rasterized=False)
    ax.set(xticks=range(w),yticks=range(h),xticklabels=cols,yticklabels=rows,xlim=(-.5,w-.5),ylim=(h-.5,-.5))
    ax.tick_params(axis='both',length=0,labelsize=8);ax.tick_params(axis='x',rotation=45)
    for tick in ax.get_xticklabels():tick.set_ha('right')
    for sp in ax.spines.values():sp.set_visible(False)
    if labels:
        from gallery_heatmap import cell_values
        cell_values(ax,values,mesh,visible=numbers,decimals=0 if numbers else 2)
    return mesh


def render(data,view,colors=None,figsize=(4.8,3.6)):
    d=validate(data,view);c=list(colors or PALETTE);c=(c*6)[:36]
    plt.rcParams.update({'font.family':font_families(),'font.size':8,'axes.labelsize':9,'xtick.labelsize':8,'ytick.labelsize':8,'svg.fonttype':'none','mathtext.fontset':'dejavusans'})
    fig,ax=_axes(figsize)
    seq=LinearSegmentedColormap.from_list('studio_blue',['#f0f3f8',c[0]])
    div=LinearSegmentedColormap.from_list('studio_div',[c[0],'#f4f5f7',c[1]])
    rng=np.random.default_rng(6483)
    if view in {'volcano_plain','volcano_labels'}:
        y=-np.log10(d.adjusted_p); side=np.where(d.significant.eq(0),0,np.where(d.log2fc<0,1,2)); labels=['Other','Down','Up'];cs=['#c6cfd9',c[0],c[1]]
        for i in range(3):ax.scatter(d.log2fc[side==i],y[side==i],s=12,c=cs[i],alpha=.78,lw=0,label=f'{labels[i]} ({sum(side==i)})')
        _finish(ax,'log₂ fold change',r'$-\log_{10}$ adjusted $P$');ax.set_ylim(bottom=0);ax.margins(y=.18)
        if view=='volcano_labels':
            marked=d[d.label.eq(1)].copy(); marked['height']=-np.log10(marked.adjusted_p)
            for sign in [-1,1]:
                g=marked[marked.log2fc*sign>=0].sort_values('height')
                if len(g):
                    ys=g.height.to_numpy().copy();gap=max(y)*.10
                    for k in range(1,len(ys)):ys[k]=max(ys[k],ys[k-1]+gap)
                    if ys[-1]>max(y)*1.05:ys-=ys[-1]-max(y)*1.05
                    xlim=max(abs(d.log2fc))*1.30
                    for (_,r),yy in zip(g.iterrows(),ys):ax.annotate(_wrap(r.feature,12),(r.log2fc,r.height),xytext=(sign*xlim,yy),ha='right' if sign>0 else 'left',va='center',fontsize=8,color=c[1 if sign>0 else 0],arrowprops=dict(arrowstyle='-',lw=.6,color='#8896a8'))
                    ax.set_xlim(-xlim*1.08,xlim*1.08)
        _legend(fig,*ax.get_legend_handles_labels())
    elif view=='clustered_matrix':
        m=d.pivot(index='feature',columns='sample',values='value');rl=linkage(pdist(m),'average');cl=linkage(pdist(m.T),'average');ri=leaves_list(rl);ci=leaves_list(cl)
        mesh=_matrix(ax,m.to_numpy()[ri][:,ci],m.index[ri],m.columns[ci],div)
        # The matrix itself shares the primary data frame with other chart types.
        # Trees and labels occupy fixed physical auxiliary bands, never a gap
        # between the row tree and its corresponding matrix cells.
        ax.yaxis.tick_right();ax.tick_params(axis='y',labelright=True,labelleft=False,pad=4)
        ax.set_yticklabels([_wrap(name,8) for name in m.index[ri]])
        top=fig.add_axes([.2,.8,.6,.1]);dendrogram(cl,ax=top,no_labels=True,color_threshold=0,above_threshold_color='#78889c');top.axis('off')
        left=fig.add_axes([.1,.2,.1,.6]);dendrogram(rl,ax=left,orientation='left',no_labels=True,color_threshold=0,above_threshold_color='#78889c');left.invert_yaxis();left.axis('off')
        cbax=fig.add_axes([.3,.96,.38,.018]);cb=fig.colorbar(mesh,cax=cbax,orientation='horizontal')
        cb.ax.xaxis.set_ticks_position('top');cb.ax.tick_params(labelsize=8,length=2,pad=2)
        cb.outline.set_visible(False);cb.solids.set_rasterized(False)
        def cluster_layout(frame):
            x,y,w,h=frame;fw,fh=fig.get_size_inches()*72
            for target in (ax,top,left,cbax):target.set_axes_locator(None)
            ax.set_position(frame)
            left.set_position([x-28/fw,y,24/fw,h])
            top.set_position([x,y+h+4/fh,w,24/fh])
            cbax.set_position([x,y+h+36/fh,min(100/fw,w*.60),4/fh])
            # Choose label wrapping and rotation from physical text extents,
            # rather than treating every string as the same number of pixels.
            renderer=fig.canvas.get_renderer()
            props=ax.get_yticklabels()[0].get_fontproperties()
            def width_pt(text):
                return renderer.get_text_width_height_descent(str(text),props,False)[0]*72/fig.dpi
            def wrap_to_width(text,limit):
                lines=[];line=''
                for word in str(text).split():
                    candidate=(line+' '+word).strip()
                    if width_pt(candidate)<=limit:line=candidate;continue
                    if line:lines.append(line);line=''
                    for char in word:
                        if line and width_pt(line+char)>limit:lines.append(line);line=''
                        line+=char
                if line:lines.append(line)
                return '\n'.join(lines)
            row_labels=[str(name) if width_pt(name)<=36 else wrap_to_width(name,36) for name in m.index[ri]]
            ax.set_yticklabels(row_labels)
            columns=[str(name) if width_pt(name)<=34 else wrap_to_width(name,34) for name in m.columns[ci]]
            ax.set_xticklabels(columns)
            diagonal=max(max(width_pt(line) for line in label.splitlines())*.707+len(label.splitlines())*6.8 for label in columns)
            rotate=90 if diagonal+3>w*fw/len(m.columns) else 45
            ax.tick_params(axis='x',rotation=rotate,pad=4)
            for label in ax.get_xticklabels():label.set_ha('center' if rotate==90 else 'right')
        fig._studio_main_axes=[ax];fig._studio_compound_layout=cluster_layout
    elif view in {'pca_ellipse','pcoa_spider','embedding_map'}:
        groups=_order(d.group)
        for i,gname in enumerate(groups):
            g=d[d.group==gname];p=g[g.role=='point'] if view=='pca_ellipse' else g
            ax.scatter(p.x,p.y,s=17,c=c[i],alpha=.72,marker=['o','s','^','D','v','P'][i],linewidth=.3,edgecolor='white',label=gname,zorder=3)
            if view=='pca_ellipse':
                b=g[g.role=='boundary'];ax.fill(b.x,b.y,fc=c[i],alpha=.10);ax.plot(b.x,b.y,c=c[i],lw=.85)
            elif view=='pcoa_spider':
                mx,my=p.x.mean(),p.y.mean()
                for r in p.itertuples():ax.plot([r.x,mx],[r.y,my],color=c[i],lw=.45,alpha=.45,zorder=1)
                ax.scatter(mx,my,s=44,marker='+',c=c[i],lw=1.3,zorder=4)
        ax.axhline(0,color='#e3e7ed',lw=.6,zorder=0);ax.axvline(0,color='#e3e7ed',lw=.6,zorder=0);ax.set_aspect('equal',adjustable='box')
        prefix='PC' if view=='pca_ellipse' else ('PCo' if view=='pcoa_spider' else 'Dimension ')
        _finish(ax,prefix+'1',prefix+'2');ax.margins(.15);_legend(fig,*ax.get_legend_handles_labels())
    elif view=='singlecell_dots':
        genes=_order(d.gene);clusters=_order(d.cluster);x=d.cluster.map({v:i for i,v in enumerate(clusters)});y=d.gene.map({v:i for i,v in enumerate(genes)})
        dots=ax.scatter(x,y,s=d.percent_expressing*2.0,c=d.mean_expression,cmap=seq,edgecolor='#e6eaf0',lw=.4,vmin=0)
        ax.set(xticks=range(len(clusters)),xticklabels=[_wrap(x,10) for x in clusters],yticks=range(len(genes)),yticklabels=[_wrap(x,12) for x in genes],xlim=(-.6,len(clusters)-.4),ylim=(len(genes)-.4,-.6));ax.tick_params(length=0);ax.tick_params(axis='x',rotation=35)
        for sp in ax.spines.values():sp.set_visible(False)
        _colorbar(fig,ax,dots,'Mean expression');_legend(fig,[ax.scatter([],[],s=p*2,c='#7189a5') for p in [25,50,100]],['25%','50%','100%'])
    elif view in {'enrichment_bars','enrichment_dots','lefse_scores'}:
        field='lda_score' if view=='lefse_scores' else 'adjusted_p';d=d.sort_values(field,ascending=view!='lefse_scores');names=d.feature if view=='lefse_scores' else d.pathway;y=np.arange(len(d));fig.subplots_adjust(left=.35)
        if view=='enrichment_bars':ax.barh(y,-np.log10(d.adjusted_p),height=.58,color=c[0]);xlabel=r'$-\log_{10}$ adjusted $P$'
        elif view=='enrichment_dots':
            dots=ax.scatter(d.gene_ratio,y,s=200*d['count']/max(d['count'].max(),1),c=-np.log10(d.adjusted_p),cmap=seq,edgecolor='white',lw=.5);xlabel='Gene ratio';_colorbar(fig,ax,dots,r'$-\log_{10}$ adjusted $P$')
            counts=sorted(set([int(d['count'].min()),int(d['count'].max())]));_legend(fig,[ax.scatter([],[],s=200*n/max(d['count'].max(),1),c='#8298b1') for n in counts],[f'{n} genes' for n in counts])
        else:
            groups=_order(d.group);ax.barh(y,d.lda_score,height=.6,color=[c[groups.index(g)] for g in d.group]);xlabel='LDA score';_legend(fig,[Rectangle((0,0),1,1,fc=c[i]) for i in range(len(groups))],groups)
        ax.set(yticks=y,yticklabels=[_wrap(n,17) for n in names],ylim=(len(d)-.4,-.6));_finish(ax,xlabel,'');ax.set_xlim(left=0)
    elif view=='venn_membership':
        groups=_order(d['set']);a=set(d.loc[d['set']==groups[0],'sample']);b=set(d.loc[d['set']==groups[1],'sample']);ax.axis('off');ax.set(xlim=(-1.8,1.8),ylim=(-1.25,1.4),aspect='equal')
        for x,col in [(-.5,c[0]),(.5,c[1])]:ax.add_patch(Circle((x,0),1,fc=col,ec=col,alpha=.22,lw=1.2))
        for x,v in [(-.95,len(a-b)),(0,len(a&b)),(.95,len(b-a))]:ax.text(x,0,str(v),ha='center',va='center',fontsize=13,color='#23354c')
        for x,name in [(-.75,groups[0]),(.75,groups[1])]:ax.text(x,1.2,_wrap(name,14),ha='center',va='center',fontsize=9)
        fig.text(.5,.07,'Counts shown; areas are schematic',ha='center',fontsize=8,color='#607087')
    elif view=='mutation_lollipop':
        ax.hlines(0,0,d.protein_length.iloc[0],color='#99a8ba',lw=4);ax.vlines(d.position,0,d['count'],color=c[0],lw=.8);ax.scatter(d.position,d['count'],s=26,c=c[1],edgecolor='white',lw=.5,zorder=3);_finish(ax,'Amino-acid position','Mutation count');ax.set_xlim(0,d.protein_length.iloc[0]);ax.set_ylim(-.03*max(d['count'].max(),1),max(d['count'].max(),1)*1.2)
    elif view=='cooccurrence_network':
        nodes=_order(pd.concat([d.source,d.target]));angles=np.linspace(0,2*np.pi,len(nodes),endpoint=False);xy={n:np.array([np.cos(t),np.sin(t)]) for n,t in zip(nodes,angles)}
        for r in d.itertuples():
            a,b=xy[r.source],xy[r.target];ax.plot([a[0],b[0]],[a[1],b[1]],color=c[0] if r.weight>0 else c[1],lw=.5+1.7*abs(r.weight)/d.weight.abs().max(),alpha=.5,ls='-' if r.weight>0 else '--',zorder=1)
        for n,p in xy.items():ax.scatter(*p,s=85,fc='white',ec=c[0],lw=1.0,zorder=2);ax.text(*(p*1.18),_wrap(n,9),ha='left' if p[0]>.1 else ('right' if p[0]<-.1 else 'center'),va='center',fontsize=8)
        ax.set(xlim=(-1.75,1.75),ylim=(-1.45,1.45),aspect='equal');ax.axis('off');_legend(fig,[Line2D([],[],color=c[0]),Line2D([],[],color=c[1],ls='--')],['Positive','Negative'])
    elif view=='oncoprint_matrix':
        samples=_order(d['sample']);genes=_order(d.gene);events=[x for x in _order(d.alteration) if x!='None'];ax.set(xlim=(-.5,len(samples)-.5),ylim=(len(genes)-.5,-.5));
        for i,g in enumerate(genes):
            for j,s in enumerate(samples):
                vals=d[(d.gene==g)&(d['sample']==s)].alteration.tolist();ax.add_patch(Rectangle((j-.43,i-.39),.86,.78,fc='#edf0f4',ec='none'))
                for k,v in enumerate([v for v in vals if v!='None']):ax.add_patch(Rectangle((j-.43,i-.39+k*.78/len(vals)),.86,.78/len(vals),fc=c[events.index(v)],ec='white',lw=.3))
        ax.set(xticks=range(len(samples)),xticklabels=[_wrap(s,8) for s in samples],yticks=range(len(genes)),yticklabels=[_wrap(g,12) for g in genes]);ax.tick_params(length=0);ax.tick_params(axis='x',rotation=45);[sp.set_visible(False) for sp in ax.spines.values()];_legend(fig,[Rectangle((0,0),1,1,fc=c[i]) for i in range(len(events))],events)
    elif view=='dose_response_result':
        for i,(name,g) in enumerate(d.groupby('series',sort=False)):
            obs=g[g.role=='observed'];fit=g[g.role=='fitted'].sort_values('concentration');ax.scatter(obs.concentration,obs.response,s=24,c=c[i],marker=['o','s','^','D'][i],edgecolor='white',lw=.4,zorder=3);ax.plot(fit.concentration,fit.response,c=c[i],lw=1.4,label=name)
        ax.set_xscale('log');_finish(ax,'Concentration','Response');_legend(fig,*ax.get_legend_handles_labels())
    elif view=='time_kill':
        for i,(name,g) in enumerate(d.groupby('group',sort=False)):
            for _,rep in g.groupby('replicate'):
                rep=rep.sort_values('time');ax.plot(rep.time,rep.log10_cfu,c=c[i],alpha=.28,lw=.7)
            m=g.groupby('time',sort=True).log10_cfu.mean();ax.plot(m.index,m.values,c=c[i],marker=['o','s','^','D','v','P'][i],ms=3,lw=1.3,label=name)
        _finish(ax,'Time','log₁₀ CFU');_legend(fig,*ax.get_legend_handles_labels())
    elif view=='mic_distribution':
        d=d.sort_values('mic');x=np.log2(d.mic);cut=np.log2(d.cutoff.iloc[0]);ax.bar(x,d['count'],width=.7,color=c[0]);ax.axvline(cut,color=c[1],ls='--',lw=1.0,label=f'Reference {d.cutoff.iloc[0]:g}');ax.set(xticks=x,xticklabels=[f'{v:g}' for v in d.mic]);_finish(ax,'MIC (original units; doubling scale)','Count');ax.set_ylim(bottom=0);_legend(fig,*ax.get_legend_handles_labels())
    elif view=='checkerboard_assay':
        m=d.pivot(index='dose_b',columns='dose_a',values='inhibition').sort_index(ascending=False);mesh=_matrix(ax,m.to_numpy()*100,[f'{v:g}' for v in m.index],[f'{v:g}' for v in m.columns],seq,0,100);ax.set_xlabel('Drug A concentration',fontsize=9);ax.set_ylabel('Drug B concentration',fontsize=9);_colorbar(fig,ax,mesh,'Inhibition (%)')
    elif view=='isobologram':
        ax.plot([0,1],[1,0],ls='--',c='#8998aa',lw=1,label='Additive reference');ax.scatter(d.dose_a/d.single_a,d.dose_b/d.single_b,s=32,c=c[0],edgecolor='white',lw=.5);_finish(ax,'Drug A / single-drug equivalent','Drug B / single-drug equivalent');ax.set_xlim(left=0);ax.set_ylim(bottom=0);ax.set_aspect('equal',adjustable='box');_legend(fig,*ax.get_legend_handles_labels())
    elif view=='zone_diameters':
        drugs=_order(d.drug)
        for i,name in enumerate(drugs):
            g=d[d.drug==name];ax.scatter(i+rng.uniform(-.13,.13,len(g)),g.diameter,s=20,c=c[i],alpha=.75,edgecolor='white',lw=.4);ax.hlines(g.breakpoint.iloc[0],i-.32,i+.32,color='#26364b',lw=1.2,ls='--')
        ax.set(xticks=range(len(drugs)),xticklabels=[_wrap(s,10) for s in drugs]);_finish(ax,'','Zone diameter (mm)');_legend(fig,[Line2D([],[],color='#26364b',ls='--')],['Supplied breakpoint'])
    elif view=='antibiogram_matrix':
        m=d.assign(percent=100*d.susceptible/d.tested).pivot(index='organism',columns='drug',values='percent');n=d.pivot(index='organism',columns='drug',values='tested').loc[m.index,m.columns];mesh=_matrix(ax,m.to_numpy(),m.index,m.columns,seq,0,100,labels=False);fig.subplots_adjust(left=.29)
        from gallery_heatmap import cell_values
        cell_values(ax,m.to_numpy(),mesh,visible=max(m.shape)<=8,decimals=0,suffix='%',extra=n.map(lambda v:f'$n$ = {v:g}').to_numpy())
        _colorbar(fig,ax,mesh,'Susceptible (%)')
    elif view=='rarefaction_result':
        for i,(name,g) in enumerate(d.groupby('sample',sort=False)):
            g=g.sort_values('depth');ax.plot(g.depth,g.richness,c=c[i],ls=['-','--',':','-.'][i%4],lw=1.2,label=name)
        _finish(ax,'Sequencing depth','Richness');ax.set_ylim(bottom=0);_legend(fig,*ax.get_legend_handles_labels(),ncol=4)
    elif view=='taxa_composition':
        m=d.pivot(index='sample',columns='taxon',values='abundance');m=m.div(m.sum(axis=1),axis=0)*100;bottom=np.zeros(len(m))
        for i,name in enumerate(m):ax.bar(range(len(m)),m[name],bottom=bottom,width=.74,color=c[i],label=name,edgecolor='white',lw=.3);bottom+=m[name].to_numpy()
        ax.set(xticks=range(len(m)),xticklabels=[_wrap(s,8) for s in m.index],ylim=(0,100));_finish(ax,'Sample','Relative abundance (%)');ax.tick_params(axis='x',rotation=45);_legend(fig,*ax.get_legend_handles_labels(),ncol=4)
    elif view=='alpha_diversity':
        groups=_order(d.group)
        for i,name in enumerate(groups):
            v=d.loc[d.group==name,'diversity'];bp=ax.boxplot([v],positions=[i],widths=.38,patch_artist=True,showfliers=False,medianprops=dict(color='#293c52',lw=1.2));bp['boxes'][0].set(facecolor=c[i],alpha=.2,edgecolor=c[i]);ax.scatter(i+rng.uniform(-.16,.16,len(v)),v,s=18,color=c[i],edgecolor='white',lw=.4,zorder=3)
        ax.set(xticks=range(len(groups)),xticklabels=[_wrap(g,12) for g in groups]);_finish(ax,'','Alpha diversity')
    elif view=='phylogeny_traits':
        nodes,parent,children,root,leaves=_tree(d);length=dict(zip(nodes.id,nodes.branch_length));x={root:0.};y={n:i for i,n in enumerate(leaves)}
        def assign(n):
            for child in children[n]:x[child]=x[n]+length[child];assign(child)
            if children[n]:y[n]=np.mean([y[ch] for ch in children[n]])
        assign(root);ax.set_position([.09,.23,.36,.65]);mx=max(x.values()) or 1
        for n in nodes.id:
            if parent[n]!='ROOT':p=parent[n];ax.plot([x[p],x[n]],[y[n],y[n]],color='#546a84',lw=.8)
            if children[n]:ys=[y[ch] for ch in children[n]];ax.plot([x[n],x[n]],[min(ys),max(ys)],color='#546a84',lw=.8)
        for n in leaves:ax.text(mx*1.06,y[n],_wrap(n,10),ha='left',va='center',fontsize=8)
        ax.set(xlim=(-mx*.03,mx*1.85),ylim=(len(leaves)-.5,-.5));ax.spines[['left','right','top']].set_visible(False);ax.set_yticks([]);ax.set_xlabel('Branch length',fontsize=8);ax.tick_params(axis='x',labelsize=8)
        t=d[d.role=='trait'];m=t.pivot(index='id',columns='trait',values='value').loc[leaves];ma=fig.add_axes([.61,.23,.34,.65]);_matrix(ma,m.to_numpy(),['']*len(leaves),m.columns,seq,0,1);_legend(fig,[Rectangle((0,0),1,1,fc='#f0f3f8'),Rectangle((0,0),1,1,fc=c[0])],['Absent','Present'])
    elif view=='gene_arrows':
        tracks=_order(d.track);xmin=d.start.min();xmax=d.end.max();span=xmax-xmin;labels=[]
        for i,name in enumerate(tracks):
            ax.hlines(i,xmin,xmax,color='#d6dee8',lw=.7)
            for j,r in enumerate(d[d.track==name].itertuples()):
                start,end=(r.start,r.end) if r.strand==1 else (r.end,r.start);arrow=FancyArrowPatch((start,i),(end,i),arrowstyle='-|>',mutation_scale=12,lw=5,color=c[j%len(PALETTE)],shrinkA=0,shrinkB=0);ax.add_patch(arrow);ax.text((r.start+r.end)/2,i-.25,_wrap(r.gene,9),ha='center',va='bottom',fontsize=8)
        ax.set(yticks=range(len(tracks)),yticklabels=[_wrap(t,12) for t in tracks],ylim=(len(tracks)-.5,-.8),xlim=(xmin-span*.02,xmax+span*.02));_finish(ax,'Genomic position','');ax.spines['left'].set_visible(False);ax.tick_params(axis='y',length=0)
    elif view=='plasmid_features':
        ax.axis('off');ax.set(xlim=(-1.7,1.7),ylim=(-1.6,1.6),aspect='equal');length=d.genome_length.iloc[0];ax.add_patch(Circle((0,0),1,fc='none',ec='#c8d2df',lw=1.2));handles=[];labels=[]
        for i,r in enumerate(d.itertuples()):
            start=r.start/length*360;end=r.end/length*360
            if end<start:end+=360
            radius=1.12 if r.strand==1 else .91;ax.add_patch(Wedge((0,0),radius,start,end,width=.16,fc=c[i],ec='white',lw=.7));mid=np.deg2rad((start+end)/2);ax.text(1.36*np.cos(mid),1.36*np.sin(mid),str(i+1),ha='center',va='center',fontsize=8,color='#314862');handles.append(Rectangle((0,0),1,1,fc=c[i]));labels.append(f'{i+1} {r.feature}')
        ax.text(0,.08,f'{length:g} bp',ha='center',va='center',fontsize=11);ax.text(0,-.16,'outer + / inner −',ha='center',fontsize=8,color='#64758b');fig.subplots_adjust(bottom=.28);_legend(fig,handles,labels,ncol=3)
    elif view=='protein_domains':
        length=d.protein_length.iloc[0];domains=d[d.role=='domain'];mut=d[d.role=='mutation'];ax.set_position([.19,.43,.76,.47])
        domain_ax=fig.add_axes([.19,.21,.76,.15],sharex=ax);domain_ax.hlines(.5,0,length,color='#9dabbc',lw=1.2)
        for i,r in enumerate(domains.itertuples()):domain_ax.add_patch(Rectangle((r.start,.34),r.end-r.start,.32,fc=c[i],ec='white',lw=.5));domain_ax.text((r.start+r.end)/2,.18,_wrap(r.label,14),ha='center',va='top',fontsize=8)
        if len(mut):ax.vlines(mut.start,0,mut['count'],lw=.8,color=c[0]);ax.scatter(mut.start,mut['count'],s=25,color=c[1],edgecolor='white',lw=.4)
        ymax=max(mut['count'].max() if len(mut) else 1,1);ax.set(xlim=(0,length),ylim=(0,ymax*1.15));_finish(ax,'','Mutation count');ax.tick_params(axis='x',labelbottom=False,length=0);ax.spines['bottom'].set_visible(False)
        domain_ax.set_ylim(-.48,1);domain_ax.spines[['left','right','top']].set_visible(False);domain_ax.set_yticks([]);domain_ax.set_xlabel('Amino-acid position',fontsize=9);domain_ax.tick_params(labelsize=8)
    elif view=='flow_alluvial':
        sources=_order(d.source);targets=_order(d.target);total=d.value.sum()
        def alluvial_layout(frame):
            ax.clear();ax.set_axes_locator(None);ax.set_position(frame)
            fw,fh=fig.get_size_inches()*72;wp=frame[2]*fw;hp=frame[3]*fh
            bar=6/wp;inset=4/wp;gap=6/hp
            usable=1-gap*(max(len(sources),len(targets))-1);scale=usable/total
            def spans(names,col):
                spacing=(1-usable)/(len(names)-1) if len(names)>1 else 0
                pos=0. if len(names)>1 else (1-usable)/2;out={}
                for name in names:
                    height=d.loc[d[col]==name,'value'].sum()*scale
                    out[name]=(pos,pos+height);pos+=height+spacing
                return out
            lsp=spans(sources,'source');rsp=spans(targets,'target')
            lo={k:v[0] for k,v in lsp.items()};ro={k:v[0] for k,v in rsp.items()}
            for row in d.itertuples():
                height=row.value*scale;y1=lo[row.source];y2=ro[row.target]
                vertices=[(bar,y1),(.42,y1),(.58,y2),(1-bar,y2),(1-bar,y2+height),(.58,y2+height),(.42,y1+height),(bar,y1+height),(bar,y1)]
                codes=[Path.MOVETO,Path.CURVE4,Path.CURVE4,Path.CURVE4,Path.LINETO,Path.CURVE4,Path.CURVE4,Path.CURVE4,Path.CLOSEPOLY]
                ax.add_patch(PathPatch(Path(vertices,codes),fc=c[sources.index(row.source)],alpha=.34,ec='none'))
                lo[row.source]+=height;ro[row.target]+=height
            for side,spans_,names in [('left',lsp,sources),('right',rsp,targets)]:
                labels=[_wrap(name,max(8,min(18,int(wp*.32/4.5)))) for name in names]
                half_heights=np.array([len(label.splitlines())*4.8+2 for label in labels])/hp
                centers=np.array([(spans_[name][0]+spans_[name][1])/2 for name in names])
                positions=centers.copy()
                for i in range(len(positions)):
                    positions[i]=max(positions[i],half_heights[i] if i==0 else positions[i-1]+half_heights[i-1]+half_heights[i])
                positions[-1]=min(positions[-1],1-half_heights[-1])
                for i in range(len(positions)-2,-1,-1):positions[i]=min(positions[i],positions[i+1]-half_heights[i+1]-half_heights[i])
                for i,(name,label,label_y) in enumerate(zip(names,labels,positions)):
                    a,b=spans_[name];x=0 if side=='left' else 1-bar
                    ax.add_patch(Rectangle((x,a),bar,b-a,fc=c[i],ec='none'))
                    anchor=bar+inset if side=='left' else 1-bar-inset
                    if abs(label_y-centers[i])*hp>1:
                        ax.plot([bar if side=='left' else 1-bar,anchor],[centers[i],label_y],color='#77879b',lw=.6,zorder=3)
                    ax.text(anchor,label_y,label,ha='left' if side=='left' else 'right',va='center',fontsize=8,color='#25384f',bbox=dict(boxstyle='square,pad=.18',fc='white',ec='none',alpha=.88),zorder=4)
            ax.set(xlim=(0,1),ylim=(1,0));ax.axis('off')
        fig._studio_main_axes=[ax];fig._studio_compound_layout=alluvial_layout
    elif view in {'rose_frequency','radar_profile'}:
        ax.remove();ax=fig.add_subplot(111,projection='polar');fig.subplots_adjust(left=.19,right=.81,bottom=.22,top=.86);ax.spines['polar'].set_color('#c9d2dd');ax.grid(color='#dce2e9',lw=.65);ax.tick_params(labelsize=8,pad=6)
        if view=='rose_frequency':
            d=d.sort_values('direction');theta=np.deg2rad(d.direction);height=np.sqrt(d['count']);ax.bar(theta,height,width=2*np.pi/len(d)*.92,color=c[0],alpha=.8,edgecolor='white',lw=.6);ma=max(d['count'].max(),1);ticks=np.array([.25,.5,1])*ma;ax.set_yticks(np.sqrt(ticks),[f'{t:g}' for t in ticks]);ax.set_theta_zero_location('N');ax.set_theta_direction(-1);ax.set_rlabel_position(35);fig.text(.5,.035,'Radial labels: count; wedge area ∝ count',ha='center',fontsize=8,color='#607087')
        else:
            measures=_order(d.measure);theta=np.linspace(0,2*np.pi,len(measures),endpoint=False);ax.set_xticks(theta,[_wrap(m,11) for m in measures]);ax.set_ylim(0,d.scale_max.iloc[0]);ax.set_yticks(np.linspace(0,d.scale_max.iloc[0],5)[1:]);
            for i,(name,g) in enumerate(d.groupby('group',sort=False)):
                v=g.set_index('measure').loc[measures,'value'].to_numpy();ax.plot(np.r_[theta,theta[0]],np.r_[v,v[0]],color=c[i],lw=1.2,marker=['o','s','^','D'][i],ms=3,label=name);ax.fill(np.r_[theta,theta[0]],np.r_[v,v[0]],color=c[i],alpha=.07)
            _legend(fig,*ax.get_legend_handles_labels())
    elif view=='causal_dag':
        nodes,levels=_dag_levels(d);xy={}
        for level in sorted(set(levels.values())):
            group=[n for n in nodes if levels[n]==level]
            for n,y in zip(group,np.linspace(.85,.15,len(group)) if len(group)>1 else [.5]):xy[n]=(level/max(max(levels.values()),1),y)
        boxes={}
        for n,(x,y) in xy.items():boxes[n]=ax.text(x,y,_wrap(n,12),ha='center',va='center',fontsize=8,bbox=dict(boxstyle='round,pad=.5',fc='#f2f5f9',ec=c[0],lw=.85),zorder=3)
        ax.set_position([.06,.20,.88,.68]);ax.set(xlim=(-.16,1.16),ylim=(-.08,1.08));ax.axis('off');fig.canvas.draw()
        for r in d.itertuples():
            skip=levels[r.target]-levels[r.source]>1;rad=.35 if skip and abs(xy[r.target][1]-xy[r.source][1])<.1 else .06
            ax.add_patch(FancyArrowPatch(xy[r.source],xy[r.target],patchA=boxes[r.source].get_bbox_patch(),patchB=boxes[r.target].get_bbox_patch(),arrowstyle='-|>',mutation_scale=10,color='#8797ab',lw=.95,shrinkA=3,shrinkB=3,connectionstyle=f'arc3,rad={rad}',zorder=1))
        fig.text(.5,.055,'Prespecified causal assumptions',ha='center',fontsize=8,color='#65768c')
    elif view=='study_timeline':
        d=d.sort_values('time');phases=_order(d.phase);span=max(d.time.max()-d.time.min(),1);ax.axhline(0,color='#a2afbf',lw=1.2)
        for i,r in enumerate(d.itertuples()):
            yy=(.62 if i%2==0 else -.62)*(1+(i//2)%2*.45);ax.plot([r.time,r.time],[0,yy],color=c[phases.index(r.phase)],lw=.8);ax.scatter(r.time,0,s=30,color=c[phases.index(r.phase)],edgecolor='white',lw=.6,zorder=3);ax.text(r.time,yy+(.05 if yy>0 else -.05),_wrap(r.event,12),ha='center',va='bottom' if yy>0 else 'top',fontsize=8)
        ax.set(xlim=(d.time.min()-span*.12,d.time.max()+span*.12),ylim=(-1.45,1.45));ax.spines[['top','left','right']].set_visible(False);ax.set_yticks([]);ax.set_xlabel('Time',fontsize=9);_legend(fig,[Line2D([],[],marker='o',ls='',color=c[i]) for i in range(len(phases))],phases)
    if view in {'clustered_matrix','flow_alluvial'}:
        from gallery_layout import apply_layout
        apply_layout(fig,view)
    fig.canvas.draw()
    return fig


def fixtures():
    """Deterministic synthetic inputs, independent of the reference artwork."""
    rng=np.random.default_rng(91347);out={}
    fc=rng.normal(0,1.4,180);p=np.minimum(1,10**(-(abs(fc)*1.6+rng.exponential(.5,180))));sig=((p<.05)&(abs(fc)>1)).astype(int)
    v=pd.DataFrame({'feature':[f'Gene{i+1}' for i in range(180)],'log2fc':fc,'adjusted_p':p,'significant':sig,'label':0});v.loc[v.sort_values('adjusted_p').head(6).index,'label']=1;out['volcano_plain']=v.drop(columns='label');out['volcano_labels']=v
    out['clustered_matrix']=pd.DataFrame([(f'G{i+1}',f'S{j+1}',np.sin(i*.7+j*.6)+rng.normal(0,.2)) for i in range(7) for j in range(8)],columns=['feature','sample','value'])
    coords=[];ell=[]
    for j,g in enumerate(['Control','Treatment','Rescue']):
        center=np.array([j*2-2,(-1)**j*.6]);pts=rng.multivariate_normal(center,[[.6,.12],[.12,.38]],22)
        for i,(x,y) in enumerate(pts):coords.append((f'{g[0]}{i}',g,x,y));ell.append((f'{g[0]}{i}',g,'point',x,y))
        # Synthetic declared boundary; deliberately not labelled a computed confidence interval.
        for i,t in enumerate(np.linspace(0,2*np.pi,61)):ell.append((f'b{i}',g,'boundary',center[0]+1.45*np.cos(t),center[1]+.95*np.sin(t)))
    out['pca_ellipse']=pd.DataFrame(ell,columns=['id','group','role','x','y']);out['pcoa_spider']=pd.DataFrame(coords,columns=['id','group','x','y']);out['embedding_map']=out['pcoa_spider'].copy()
    out['singlecell_dots']=pd.DataFrame([(f'Gene{i+1}',f'Cluster{j+1}',rng.uniform(0,3),rng.uniform(5,95)) for i in range(6) for j in range(5)],columns=['gene','cluster','mean_expression','percent_expressing'])
    enrich=pd.DataFrame({'pathway':['Lipid metabolism','DNA repair','Stress response','Cell cycle','Apoptosis','Transport'],'gene_ratio':[.27,.22,.19,.15,.11,.07],'adjusted_p':[.00003,.0002,.001,.003,.01,.04],'count':[24,21,18,15,12,8]});out['enrichment_bars']=enrich[['pathway','adjusted_p']].copy();out['enrichment_dots']=enrich
    out['venn_membership']=pd.DataFrame([(f'S{i}','Set A') for i in range(35)]+[(f'S{i}','Set B') for i in range(20,52)],columns=['sample','set'])
    out['mutation_lollipop']=pd.DataFrame({'mutation':[f'm{i}' for i in range(8)],'position':[25,62,103,180,225,274,346,391],'count':[2,4,3,9,5,2,6,3],'protein_length':420})
    out['lefse_scores']=pd.DataFrame({'feature':['Taxon A','Taxon B','Taxon C','Taxon D','Taxon E','Taxon F'],'group':['Control','Treatment']*3,'lda_score':[4.3,4.0,3.6,3.1,2.9,2.5]})
    out['cooccurrence_network']=pd.DataFrame([(f'Taxon{i}',f'Taxon{j}',rng.choice([-1,1])*rng.uniform(.3,.9)) for i,j in [(1,2),(1,3),(1,5),(2,4),(2,6),(3,4),(3,7),(4,5),(5,7),(6,7)]],columns=['source','target','weight'])
    out['oncoprint_matrix']=pd.DataFrame([(f'S{j+1}',g,str(rng.choice(['None','Missense','Deletion','Amplification'],p=[.55,.25,.1,.1]))) for g in ['TP53','KRAS','PIK3CA','APC','PTEN'] for j in range(9)],columns=['sample','gene','alteration'])
    rows=[]
    for g,ic in [('Cell A',.9),('Cell B',2.4)]:
        for role,xs in [('observed',np.geomspace(.01,100,9)),('fitted',np.geomspace(.01,100,70))]:
            for x in xs:rows.append((g,role,x,100/(1+(x/ic)**1.15)+(rng.normal(0,2) if role=='observed' else 0)))
    out['dose_response_result']=pd.DataFrame(rows,columns=['series','role','concentration','response'])
    out['time_kill']=pd.DataFrame([(g,f'R{r}',t,6+(slope*t)+rng.normal(0,.13)) for g,slope in [('Control',.035),('Drug A',-.08),('Combination',-.16)] for r in range(3) for t in [0,2,4,8,12,24]],columns=['group','replicate','time','log10_cfu'])
    out['mic_distribution']=pd.DataFrame({'mic':2.**np.arange(-3,5),'count':[3,9,21,34,25,12,4,2],'cutoff':4.})
    out['checkerboard_assay']=pd.DataFrame([(a,b,1-np.exp(-(.23*a+.3*b+.045*a*b))) for a in [0,.25,.5,1,2,4] for b in [0,.25,.5,1,2,4]],columns=['dose_a','dose_b','inhibition'])
    out['isobologram']=pd.DataFrame({'combination':['A','B','C','D','E'],'dose_a':[.12,.22,.35,.52,.71],'dose_b':[.8,.6,.44,.3,.12],'single_a':1.,'single_b':1.})
    out['zone_diameters']=pd.DataFrame([(f'I{i}',g,max(1,rng.normal(mu,2)),br) for g,mu,br in [('Drug A',23,20),('Drug B',18,17),('Drug C',25,22)] for i in range(12)],columns=['isolate','drug','diameter','breakpoint'])
    out['antibiogram_matrix']=pd.DataFrame([(g,drug,100,int(rng.integers(35,98))) for g in ['Species A','Species B','Species C','Species D'] for drug in ['Drug A','Drug B','Drug C','Drug D']],columns=['organism','drug','tested','susceptible'])
    out['rarefaction_result']=pd.DataFrame([(f'Sample {j+1}',int(x),float((80+j*22)*(1-np.exp(-x/(2100+j*300))))) for j in range(4) for x in np.linspace(0,15000,60)],columns=['sample','depth','richness'])
    out['taxa_composition']=pd.DataFrame([(f'S{i+1}',f'Taxon {j+1}',float(a)) for i in range(8) for j,a in enumerate(rng.dirichlet([2,3,2,1,1]))],columns=['sample','taxon','abundance'])
    out['alpha_diversity']=pd.DataFrame([(f'{g}{i}',g,float(rng.normal(mu,.25))) for g,mu in [('Control',2.6),('Treatment',2.0),('Rescue',2.45)] for i in range(12)],columns=['sample','group','diversity'])
    nodes=[('root','ROOT',0),('cladeA','root',.3),('cladeB','root',.2),('S1','cladeA',.25),('S2','cladeA',.35),('S3','cladeB',.4),('S4','cladeB',.27),('S5','cladeB',.32)]
    tree=[('node',n,p,bl,'NA',0) for n,p,bl in nodes]+[('trait',n,'NA',0,t,int(rng.integers(0,2))) for n in ['S1','S2','S3','S4','S5'] for t in ['Gene A','Gene B','Gene C','Gene D']];out['phylogeny_traits']=pd.DataFrame(tree,columns=['role','id','parent','branch_length','trait','value'])
    out['gene_arrows']=pd.DataFrame([(track,f'g{j+1}',start+offset,end+offset,strand) for track,offset in [('Strain A',0),('Strain B',80),('Strain C',-60)] for j,(start,end,strand) in enumerate([(0,750,1),(900,1600,1),(1750,2350,-1),(2600,3500,1)])],columns=['track','gene','start','end','strand'])
    out['plasmid_features']=pd.DataFrame({'feature':['repA','mobA','resistance','oriT','cargo'],'start':[100,1450,2800,4300,5100],'end':[1100,2500,3900,4850,6000],'strand':[1,1,-1,1,-1],'genome_length':6400})
    out['protein_domains']=pd.DataFrame([('domain','Binding',20,130,0,450),('domain','Catalytic',175,325,0,450),('domain','Regulatory',355,430,0,450),('mutation','M1',75,75,3,450),('mutation','M2',230,230,8,450),('mutation','M3',290,290,4,450),('mutation','M4',390,390,5,450)],columns=['role','label','start','end','count','protein_length'])
    out['flow_alluvial']=pd.DataFrame([('Baseline A','Follow-up A',38),('Baseline A','Follow-up B',12),('Baseline B','Follow-up A',9),('Baseline B','Follow-up B',28),('Baseline B','Follow-up C',7),('Baseline C','Follow-up B',5),('Baseline C','Follow-up C',22)],columns=['source','target','value'])
    out['rose_frequency']=pd.DataFrame({'direction':np.arange(0,360,45),'count':[18,12,8,14,26,32,21,13]})
    out['radar_profile']=pd.DataFrame([(g,m,float(v),100) for g,vs in [('Method A',[82,76,92,65,80]),('Method B',[74,85,68,89,75])] for m,v in zip(['Accuracy','Recall','Specificity','Precision','F1 score'],vs)],columns=['group','measure','value','scale_max'])
    out['causal_dag']=pd.DataFrame([('Age','Exposure'),('Age','Outcome'),('Exposure','Mediator'),('Mediator','Outcome'),('Exposure','Outcome'),('Covariate','Exposure'),('Covariate','Outcome')],columns=['source','target'])
    out['study_timeline']=pd.DataFrame({'event':['Recruitment','Baseline','Treatment','Follow-up 1','Follow-up 2','Analysis'],'phase':['Screening','Screening','Intervention','Follow-up','Follow-up','Analysis'],'time':[-2,0,2,6,10,14]})
    return out
