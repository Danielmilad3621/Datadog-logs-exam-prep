from collections import defaultdict
categories = {
'LF1': 'Logging Systems – Rationale & Justification',
'LF2': 'Logging Formats',
'LF3': 'Log Emission',
'LC1': 'Enabling Log Collection',
'LC2': 'Log Filtering & Obfuscation',
'LC3': 'Processors & Pipelines',
'LC4': 'Standard Attributes',
'SF1': 'Live vs. Explorer',
'SF2': 'Search Syntax',
'SF3': 'Explorer Functionality',
'LA1': 'Filtering and Excluding',
'LA2': 'Aggregations',
'LA3': 'Visualizing',
'LU1': 'Monitors & Alerting',
'LU2': 'Metric Generation',
'LU3': 'Exporting',
'LT1': 'Ingestion Issues',
'X1': 'Additional: Retention, Archives & Rehydration',
'X2': 'Additional: Security, RBAC & Audit Trail',
'X3': 'Additional: Cross-product, architecture & APIs'
}
assign = {
'LF1': [12,32,72,90,132,178],
'LF2': [19,26,33,44,56,88,104,108,127,134,137,164,185],
'LF3': [4,9,53,95],
'LC1': [3,6,10,15,25,34,35,42,47,49,84,99,103,110,126,139,148,150,151,156,161,165,166,168,171,173,176,180,186,187,197,199],
'LC2': [18,37,43,65,68,81,85,174,208],
'LC3': [8,11,13,14,21,23,46,48,50,74,75,76,98,106,116,122,131,140,141,143,145,147,149,153,182,184,202],
'LC4': [],
'SF1': [],
'SF2': [136],
'SF3': [30,31,36,52,73,82,125,129,138,203],
'LA1': [29,54,70,91,105,120],
'LA2': [22,97,135,144,146],
'LA3': [5,39,60,67,102,124,154,155,157,170,181,196],
'LU1': [1,20,28,55,62,79,83,86,87,89,100,109,111,112,121,128,159,167,169,205],
'LU2': [27,94,96,101,114,130,172],
'LU3': [58,63,77,107,119,207],
'LT1': [17,57,59,115,162,183,192],
'X1': [7,24,38,45,64,69,71,78,80,92,113,117,118,133,142,158,160,175,189,191,193,194,204,210],
'X2': [2,16,40,41,66,93,163,177,179,188,190,198,200,201,206,209],
'X3': [51,61,123,152,195]
}
assigned={}
for c,ids in assign.items():
 for i in ids:
  if i in assigned: print('DUP', i, assigned[i], c)
  assigned[i]=c
print('missing:',sorted(set(range(1,211))-set(assigned)))
print('extra:',sorted(set(assigned)-set(range(1,211))))
print('Total classified',len(assigned))
print('------')
for c,ids in assign.items(): print(c,len(ids),categories[c], ', '.join(map(str,ids)))
for name,keys in [('Fundamentals',['LF1','LF2','LF3']),('Collection',['LC1','LC2','LC3','LC4']),('Search',['SF1','SF2','SF3']),('Analysis',['LA1','LA2','LA3']),('Utilization',['LU1','LU2','LU3']),('Troubleshooting',['LT1']),('Additional',['X1','X2','X3'])]:
 print('DOMAIN',name,sum(len(assign[i]) for i in keys))
