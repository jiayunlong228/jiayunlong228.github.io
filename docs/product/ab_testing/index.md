# A/B 实验方法论总览

这组文章整理的是 A/B 实验的方法论。Firebase 可以作为常见实验平台来理解分流、参数下发、指标统计和结果页，但文章重点不放在具体业务案例，也不展开 SQL 实现。

一套完整的 A/B 实验方法应该回答四个问题：

| 问题 | 关键动作 |
| --- | --- |
| 实验为什么要做 | 明确问题、假设、目标用户和最小可接受收益 |
| 实验能不能被正确执行 | 设计分流、实验单位、样本量、周期、入场条件和指标口径 |
| 实验数据是否可信 | 验证分流比例、用户属性均衡、激活漏斗、埋点和成熟窗口 |
| 实验结果如何转成决策 | 结合效果大小、置信区间、显著性、因果边界和护栏指标判断 |

## 阅读顺序

- [A/B 实验背景和操作流程](background-and-workflow.md)：从实验立项到上线复盘，重点讲完整流程、分流验证和样本量估算。
- [数据处理流程与理论背景](data-and-theory.md)：解释实验数据应该如何聚合，比例类和均值类指标如何检验，以及样本量和分流校验背后的公式直觉。
- [如何解读实验结果](result-interpretation.md)：说明如何阅读 p-value、置信区间、效果大小和护栏指标，避免把“显著”直接等同于“应该上线”。

## 方法论主线

一次实验可以按下面顺序推进：

1. 明确问题和实验假设
2. 定义实验单位、目标人群、分流方案和激活口径
3. 选择主指标、护栏指标和诊断指标
4. 估算样本量和实验周期
5. 配置实验并完成上线前 QA
6. 实验开始后先验证分流、属性均衡和激活漏斗
7. 等待关键指标成熟后做统计分析
8. 根据主指标、护栏指标、因果边界和业务价值做决策
9. 上线、放量、重做或沉淀为下一轮假设

Firebase 的作用是帮助完成其中的实验配置、随机分流、参数下发、Activation event 入场和基础结果展示。真正决定实验质量的，仍然是方法论本身：假设是否清楚，分流是否可靠，有效样本是否足够，指标口径是否稳定，结论是否克制。

## 参考资料

- [Firebase A/B Testing 概览](https://firebase.google.com/docs/ab-testing)
- [Firebase Remote Config experiments 配置](https://firebase.google.com/docs/ab-testing/abtest-config)
- [About Firebase A/B tests](https://firebase.google.com/docs/ab-testing/ab-concepts)
- [Inspect A/B Testing data with BigQuery](https://firebase.google.com/docs/ab-testing/bigquery)
