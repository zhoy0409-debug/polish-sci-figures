"""Index design requirements from user-supplied cards; never embed their images or execute R.

Usage: python scripts/build_reference_catalogue.py SOURCE_DIRECTORY
The local reference cards use synthetic data. They are visual references, not
computed results or automatically applicable statistical analyses.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'skills/polish-sci-figures/references/design-pattern-index.json'
# Curated terminology and input contracts. No heuristics are inferred from images.
TITLES = '''重复实验分层散点|雨云图|集合交集图|Gardner–Altman 估计图|Sina 分布散点|色觉友好配色|Cumming 估计图|原始观测散点|Bland–Altman 一致性图|森林图|连续色阶指南|Cleveland 点图|火山图|Kaplan–Meier 生存曲线|Meta 分析漏斗图|ROC 曲线|校准曲线|决策曲线|聚类热图|PCA 双标图|Q–Q 图|缺口箱线图|剂量反应曲线|棋盘稀释试验|马赛克图|桑基与流向图|相关矩阵|限制性立方样条|列线图|SHAP 汇总图|生长曲线|时间杀菌曲线|MIC 分布与 ECOFF|配对斜率图|堆叠丰度图|稀释曲线|PCoA 排序图|系统树与基因矩阵|棒棒糖图|富集气泡图|累积发生函数|山脊图|瀑布图|发散式 Likert 图|曼哈顿图|MA 图|药敏谱矩阵|Schoenfeld 残差图|精确率–召回率曲线|小提琴图|Anscombe 四重奏|基因箭头图|STL 时间序列分解|六边形分箱图|药代动力学与 fT > MIC|突变选择窗|GSEA 富集曲线|单细胞点图|UMAP 嵌入|三元图|矩形树图|平行坐标|网络图|u 控制图|因果有向无环图|PRISMA 流程图|排名变化图|流行曲线|日历热图|图标阵列|玫瑰图|Deming 回归|经验累积分布|个体轨迹图|机构比较漏斗图|ICE 与 PDP|药物协同作用曲面|缺失数据图|泳道图|哑铃图|误差棒表达|交互作用图|Euler 集合图|回归系数图|碎石图|分面小多图|Lorenz 曲线|偏残差图|LOESS 平滑|累积 Meta 分析|秩丰度曲线|Hill 多样性谱|Muller 演化图|环状质粒图|弦图|CUSUM 控制图|中介路径图|Fagan 列线图|龙卷风图|分位数回归|Bootstrap 分布|双图 ROC'''.split('|')
CATEGORIES = {
    'distribution': [1,2,5,8,12,22,42,50,73],
    'paired': [9,34,72,80],
    'effects': [4,7,10,15,39,43,75,81,84,90,99,101],
    'relationship': [20,21,27,28,29,30,37,48,51,54,59,62,76,82,85,88,89,100],
    'longitudinal': [14,23,31,32,41,53,55,56,64,67,68,69,71,74,79,96],
    'matrix': [3,19,24,25,26,35,47,60,61,70,77,78,83,95],
    'omics': [13,33,36,38,40,45,46,52,57,58,91,92,93,94],
    'roc': [16,17,18,49,98,102],
    'other': [6,11,44,63,65,66,86,87,97],
}
# Existing renderers with closely corresponding visual/data semantics only.
MATCHES = {2:'raincloud',4:'estimation_graphic',7:'group_estimate_forest',8:'raw_points_estimate_ci',10:'forest_intervals',13:'volcano',14:'kaplan_meier_risk_table',16:'roc',23:'dose_response',31:'timecourse_trajectories',34:'paired_trajectories',35:'composition_stacked',39:'feature_lollipop',40:'enrichment_bubble',43:'diverging_bars',49:'precision_recall',50:'violin_raw_points',73:'ecdf',74:'timecourse_trajectories',79:'swimmer',84:'forest_intervals',102:'roc_two_graph'}
INPUTS = '''组别、独立实验编号、实验内观测值|组别与连续观测值|样本编号与集合成员关系|两组原始观测；配对设计需配对编号|组别与连续观测值|分类数量与色觉可辨识要求|多组观测与预设比较|组别与原始观测值|同一样本的两种测量结果|效应值、置信区间及效应尺度|数值范围、顺序或中心参考值|类别与数值|效应量与多重比较校正结果|随访时间与结局指示|研究效应与标准误|二分类真值与预测分数|结局与预测概率|结局、预测概率与决策阈值|数值矩阵、距离与聚类规则|原始特征矩阵、标准化规则与载荷|观测值与指定参考分布|各组连续观测值|剂量、响应及拟合模型|双药浓度矩阵与抑制结果|列联计数|阶段、类别及流量|变量矩阵与相关方法|结局、自变量、协变量与结点设置|已拟合模型及预测转换规则|模型、特征值与 SHAP 值|时间、观测与重复编号|时间、药物条件与菌落计数|MIC 分布及 ECOFF 估计依据|配对编号与前后测量|样本、分类与丰度|抽样深度与物种观测|距离矩阵与分组；检验需置换设计|系统树及对齐的基因存在矩阵|类别与数值|通路、效应、条目数与校正 P 值|随访时间及互斥事件类型|组别与连续观测值|个体变化值及参考基线|有序响应等级及频数|基因组位置与关联 P 值|平均表达及对数表达变化|菌株、药物及药敏类别|生存模型与 Schoenfeld 残差|二分类真值与预测分数|组别与连续观测值|四组演示数据；用于说明汇总统计局限|基因位置、方向与注释|规则时间序列及周期|成对连续变量|浓度–时间数据、游离比例与 MIC|浓度–时间数据、MIC 与 MPC|排序统计量及基因集成员|细胞群、表达均值与表达比例|已计算嵌入坐标及参数记录|总和固定的三个组分|层级类别与非负权重|多个数值变量与缩放规则|节点与边表|事件计数及暴露量|变量与有向边；需研究假设|检索、筛选与纳入排除计数|各时间点排名|发病日期与分层计数|日期与数值|人群总数与事件计数|周期位置与频数|两种测量与误差方差比|连续观测值|个体编号、时间与观测|机构样本量、率及参考模型|拟合模型与特征数据|双药剂量响应及协同参考模型|原始表格及缺失掩码|个体随访区间与事件|类别与两端测量值|估计值及明确的 SD、SE 或 CI|因素组合与模型估计及区间|集合成员或交集计数|系数、区间与效应尺度|各主成分特征值|统一字段及分面变量|非负值或累计份额|已拟合回归模型与残差|成对观测及平滑参数|按时间排序的研究效应与标准误|分类丰度|分类丰度及多样性阶数|谱系关系及时间丰度|环状序列长度及注释坐标|节点间非负流量矩阵|有序观测、目标值及控制参数|已拟合中介模型及路径估计|验前概率及似然比|基准结果及单因素敏感性分析|结局、自变量及指定分位数|重抽样估计值及区间方法|真值、分数与有限阈值'''.split('|')

INPUTS_EN = 'Groups, independent experiment IDs and within-experiment observations|Groups and continuous observations|Sample IDs and set memberships|Two groups of observations; pairing IDs for paired designs|Groups and continuous observations|Number of categories and color-vision requirements|Observations across groups and planned comparisons|Groups and raw observations|Two measurements on the same samples|Effect estimates, confidence intervals and effect scale|Numeric range, ordering or reference midpoint|Categories and values|Effect sizes and multiplicity-adjusted results|Follow-up times and event indicators|Study effects and standard errors|Binary outcomes and prediction scores|Outcomes and predicted probabilities|Outcomes, predicted probabilities and decision thresholds|Numeric matrix, distance and clustering rules|Feature matrix, scaling rules and component loadings|Observations and a specified reference distribution|Continuous observations by group|Dose, response and fitted model|Two-drug concentration matrix and inhibition results|Contingency counts|Stages, categories and flow quantities|Variable matrix and correlation method|Outcome, predictors, covariates and knot specification|Fitted model and prediction conversion rules|Model, feature values and SHAP values|Time, observations and replicate IDs|Time, drug conditions and colony counts|MIC distribution and documented ECOFF estimation|Pair IDs and before/after measurements|Samples, categories and abundances|Sampling depth and observed taxa|Distance matrix and groups; permutation design for inference|Phylogenetic tree and aligned gene-presence matrix|Categories and values|Pathways, effects, counts and adjusted P values|Follow-up times and mutually exclusive event types|Groups and continuous observations|Individual changes and baseline reference|Ordered response levels and counts|Genomic positions and association P values|Mean expression and log expression changes|Isolates, drugs and susceptibility categories|Survival model and Schoenfeld residuals|Binary outcomes and prediction scores|Groups and continuous observations|Four demonstration datasets illustrating summary-statistic limitations|Gene coordinates, directions and annotations|Regular time series and seasonal period|Paired continuous variables|Concentration-time data, free fraction and MIC|Concentration-time data, MIC and MPC|Ranked statistics and gene-set memberships|Cell groups, mean expression and expression fractions|Computed embedding coordinates and parameter records|Three components with a fixed total|Hierarchical categories and nonnegative weights|Multiple numeric variables and scaling rules|Node and edge tables|Event counts and exposure denominators|Variables and directed edges justified by study assumptions|Search, screening, inclusion and exclusion counts|Ranks at successive time points|Onset dates and stratified counts|Dates and values|Population total and event counts|Cyclic positions and frequencies|Two measurements and their error-variance ratio|Continuous observations|Individual IDs, times and observations|Institution sample sizes, rates and reference model|Fitted model and feature data|Two-drug dose-response data and synergy reference model|Original table and missingness mask|Individual follow-up intervals and events|Categories and two endpoint values|Estimates and explicitly identified SD, SE or CI|Factor combinations, model estimates and intervals|Set memberships or intersection counts|Coefficients, intervals and effect scale|Eigenvalues by component|Consistent variables and faceting field|Nonnegative values or cumulative shares|Fitted regression model and residuals|Paired observations and smoothing parameters|Studies ordered by time with effects and standard errors|Taxon abundances|Taxon abundances and diversity orders|Lineage relationships and abundances over time|Circular sequence length and annotation coordinates|Nonnegative flow matrix between nodes|Ordered observations, target and control parameters|Fitted mediation model and path estimates|Pretest probability and likelihood ratio|Baseline result and one-way sensitivity analyses|Outcome, predictors and specified quantiles|Resampled estimates and interval method|Outcomes, scores and finite thresholds'.split('|')

def main(source):
    source = Path(source)
    titles = {}
    for path in source.rglob('*.R'):
        text = path.read_text(encoding='utf-8-sig')
        for number,title in re.findall(r'\bcard\(\s*(\d+)\s*,\s*"([^"\n]+)"', text):
            titles[int(number)] = title
    assert len(TITLES) == len(INPUTS) == len(INPUTS_EN) == 102
    assert sorted(n for values in CATEGORIES.values() for n in values) == list(range(1,103))
    records = []
    for path in sorted(source.rglob('*.png')):
        match = re.match(r'(\d+)_(.+)', path.stem)
        if not match: continue
        number = int(match[1])
        records.append(dict(id='reference_'+path.stem,number=number,
            title={'zh':TITLES[number-1],'en':titles.get(number,match[2].replace('_',' ').title())},
            inputs={'zh':INPUTS[number-1],'en':INPUTS_EN[number-1]},
            category=next(key for key,values in CATEGORIES.items() if number in values),
            renderer=MATCHES.get(number),kind='design-guide' if number in (6,11,51,81,86) else 'chart-reference',
            source=path.relative_to(source).as_posix(),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            dataKind='synthetic',status='related-renderer' if MATCHES.get(number) else 'design-backlog'))
    records.sort(key=lambda x:x['number'])
    assert [r['number'] for r in records] == list(range(1,103))
    OUTPUT.write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Packaged {len(records)} reference cards; {OUTPUT.stat().st_size/1e6:.1f} MB, design requirements only; no source images')

if __name__=='__main__':main(sys.argv[1])
