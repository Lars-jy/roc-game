/** Public case documents only. Player-specific receipts and solutions are not shipped here. */
export const DOCUMENTS = [
  {
    "id": "D01",
    "title": "稳盈计划产品说明及认购邀约",
    "issuer": "金鼎财富",
    "date": "4月1日",
    "number": "JD-SY-INV-01",
    "type": "brochure",
    "blocks": [
      {
        "kind": "text",
        "title": "产品说明",
        "body": "本计划围绕JD-01价差交易项目运行。平台声称采用专业交易模型，可在市场涨跌中持续取得收益，并按月向客户支付固定8%的收益；平台同时作出本金安全承诺。"
      },
      {
        "kind": "table",
        "title": "产品要素",
        "headers": [
          "项目",
          "内容"
        ],
        "rows": [
          [
            "产品名称",
            "稳盈计划"
          ],
          [
            "项目编号",
            "JD-01"
          ],
          [
            "投入方式",
            "客户自行选择认购金额"
          ],
          [
            "收益来源",
            "JD-01项目实际经营成果（平台说明）"
          ],
          [
            "宣传收益",
            "每月固定8%"
          ],
          [
            "服务窗口",
            "七号业务柜台"
          ]
        ]
      },
      {
        "kind": "text",
        "title": "办理事项",
        "body": "客户可先查看合同与项目资料。旧客可提交退出申请，实际支付按当期兑付安排处理；体验批次另见《月结体验批次认购确认书》。资料递送可选择纸质副本或柜台查阅。"
      }
    ],
    "pdfHref": "./assets/materials/D01.pdf",
    "nativeHref": "./assets/materials/D01.docx"
  },
  {
    "id": "D02",
    "title": "认购与收益分配协议（节选）",
    "issuer": "金鼎财富",
    "date": "3月31日",
    "number": "JD-AG-01",
    "type": "contract",
    "blocks": [
      {
        "kind": "text",
        "title": "第一条 项目及账户",
        "body": "本计划披露的唯一投资项目为JD-01价差交易。平台对客说明的“投资收益”来自该项目实际经营成果。认购与兑付经平台控制的C户、M户办理；账户脱敏信息见账户核对单。"
      },
      {
        "kind": "text",
        "title": "第二条 收益约定",
        "body": "旧客组按存续认购本金每月8%支付约定收益。新客丙、丁、戊分别自认购日起锁定三个月，收益按月8%单利累计，到期与本金一并支付；锁定期间不逐月支付。"
      },
      {
        "kind": "text",
        "title": "第三条 收益展示",
        "body": "平台会提供项目月报和客户收益记录。账户中的待付记录与银行实际到账分别登记，客户可申请核对支付流水。"
      },
      {
        "kind": "text",
        "title": "第四条 退出申请",
        "body": "旧客可向柜台提交退出申请，是否已支付以银行到账记录为准。月结体验批次适用单独确认书，不沿用三个月锁定条款。"
      },
      {
        "kind": "text",
        "title": "第五条 资料与通知",
        "body": "对客资料包括项目说明、月报和付款记录。交易明细以模型保密为由另行管理；合同通知采用柜台公告或书面送达。客户可保留合同及付款凭证副本。"
      },
      {
        "kind": "text",
        "title": "第六条 文件管理",
        "body": "本节选对应项目及收益口径条款，完整协议编号与本页一致。资料归档由客户服务组办理，双方各持副本一份。"
      }
    ],
    "pdfHref": "./assets/materials/D02.pdf",
    "nativeHref": "./assets/materials/D02.docx"
  },
  {
    "id": "D03",
    "title": "客户入账回单（周岚）",
    "issuer": "澄川银行",
    "date": "4月1日",
    "number": "HC-RC-ZL-03",
    "type": "receipts",
    "blocks": [
      {
        "kind": "table",
        "title": "已核对收款记录",
        "headers": [
          "日期",
          "回单编号",
          "交易流水号",
          "付款人",
          "收款人",
          "入账金额",
          "用途"
        ],
        "rows": [
          [
            "1月31日",
            "RCPT-101",
            "PAY-101",
            "金鼎财富C户",
            "周岚",
            4800,
            "经营收益"
          ],
          [
            "2月28日",
            "RCPT-201",
            "PAY-201",
            "金鼎财富C户",
            "周岚",
            4800,
            "经营收益"
          ],
          [
            "3月31日",
            "RCPT-301",
            "PAY-301",
            "金鼎财富C户",
            "周岚",
            4800,
            "经营收益"
          ]
        ],
        "moneyCols": [
          5
        ]
      },
      {
        "kind": "text",
        "title": "账户信息",
        "body": "付款账号：3100 **** **** 0101；收款账号：6228 **** **** 0601。币种：人民币。记账状态：三笔均已入账。回单打印日期为模拟年度4月1日。"
      },
      {
        "kind": "text",
        "title": "回单说明",
        "body": "本回单记录银行入账事实，用途字段来自付款指令。请核对收款人、金额和交易流水号；重复打印不重复记账。"
      }
    ],
    "pdfHref": "./assets/materials/D03.pdf",
    "nativeHref": "./assets/materials/D03.docx"
  },
  {
    "id": "D04",
    "title": "JD-01项目收益及分配月报",
    "issuer": "金鼎财富",
    "date": "3月31日",
    "number": "JD-01-YB-03",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "项目经营与分配",
        "headers": [
          "项目",
          "1月",
          "2月",
          "3月",
          "三期累计/期末"
        ],
        "rows": [
          [
            "价差交易收益",
            12800,
            14600,
            13900,
            41300
          ],
          [
            "利息及其他项目收益",
            200,
            300,
            100,
            600
          ],
          [
            "收益合计",
            13000,
            14900,
            14000,
            41900
          ],
          [
            "交易手续费",
            1200,
            1500,
            1300,
            4000
          ],
          [
            "清算服务费",
            800,
            1100,
            900,
            2800
          ],
          [
            "项目管理服务费",
            1800,
            2400,
            2200,
            6400
          ],
          [
            "资讯与数据服务费",
            700,
            900,
            800,
            2400
          ],
          [
            "其他运营费用",
            500,
            1000,
            800,
            2300
          ],
          [
            "费用合计",
            5000,
            6900,
            6000,
            17900
          ],
          [
            "项目经营净收益",
            8000,
            8000,
            8000,
            24000
          ],
          [
            "期初未分配收益",
            0,
            0,
            0,
            0
          ],
          [
            "本期经营净收益",
            8000,
            8000,
            8000,
            24000
          ],
          [
            "以前期间调整",
            0,
            0,
            0,
            0
          ],
          [
            "可分配经营收益",
            8000,
            8000,
            8000,
            24000
          ],
          [
            "已分配收益（旧客组）",
            8000,
            8000,
            8000,
            24000
          ],
          [
            "期末未分配收益",
            0,
            0,
            0,
            0
          ]
        ],
        "moneyCols": [
          1,
          2,
          3,
          4
        ]
      },
      {
        "kind": "text",
        "title": "附注",
        "body": "交易明细涉及模型保密，未随表提供。"
      }
    ],
    "pdfHref": "./assets/materials/D04.pdf",
    "nativeHref": "./assets/materials/D04.xlsx"
  },
  {
    "id": "D05",
    "title": "JD-01项目托管与业务核验回复",
    "issuer": "澄川项目核验中心",
    "date": "4月1日",
    "number": "HY-JD-003",
    "type": "letter",
    "blocks": [
      {
        "kind": "text",
        "title": "致送对象",
        "body": "金鼎财富JD-01项目资料核验申请方："
      },
      {
        "kind": "text",
        "title": "核验范围",
        "body": "根据本案授权，对合同指定的唯一JD-01项目在模拟年度1月1日至3月31日的全部委托、成交、结算记录及完整对应项目账簿进行核验。"
      },
      {
        "kind": "table",
        "title": "核验结果",
        "headers": [
          "核验项目",
          "第1期",
          "第2期",
          "第3期",
          "三期合计",
          "单位"
        ],
        "rows": [
          [
            "委托数量",
            0,
            0,
            0,
            0,
            "笔"
          ],
          [
            "成交数量",
            0,
            0,
            0,
            0,
            "笔"
          ],
          [
            "已实现经营利润",
            0,
            0,
            0,
            0,
            "元"
          ],
          [
            "项目回款",
            0,
            0,
            0,
            0,
            "元"
          ]
        ]
      },
      {
        "kind": "text",
        "title": "账簿核对",
        "body": "平台提交的完整对应项目账簿中，无其他实际执行项目。上述利润结果结合全部业务记录与账簿核验形成，不仅依据回款数额判断。"
      },
      {
        "kind": "text",
        "title": "适用范围",
        "body": "本回复仅核验上述项目与期间的业务情况，不单独认定对客付款来源。经办、复核按授权资料办理，资料递送为书面副本。"
      }
    ],
    "pdfHref": "./assets/materials/D05.pdf",
    "nativeHref": "./assets/materials/D05.docx"
  },
  {
    "id": "D06",
    "title": "项目账户及认购资金核对表",
    "issuer": "金鼎财富资料核对组",
    "date": "4月1日",
    "number": "JD-ZH-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "账户登记",
        "headers": [
          "户别",
          "账户名",
          "开户机构",
          "脱敏账号",
          "用途"
        ],
        "rows": [
          [
            "C",
            "金鼎财富",
            "澄川银行",
            "3100 **** **** 0101",
            "认购收款及对客支付"
          ],
          [
            "M",
            "金鼎财富",
            "澄川银行",
            "3100 **** **** 0102",
            "留存资金"
          ]
        ]
      },
      {
        "kind": "table",
        "title": "认购与入账对应",
        "headers": [
          "客户",
          "合同编号",
          "认购日期",
          "认购本金",
          "入账流水号",
          "资金性质"
        ],
        "rows": [
          [
            "丙",
            "CN-B-001",
            "1月1日",
            12000,
            "IN-101",
            "认购本金"
          ],
          [
            "丁",
            "CN-D-001",
            "2月1日",
            10000,
            "IN-201",
            "认购本金"
          ],
          [
            "戊",
            "CN-W-001",
            "3月1日",
            9000,
            "IN-301",
            "认购本金"
          ]
        ],
        "moneyCols": [
          3
        ]
      },
      {
        "kind": "text",
        "title": "核对范围",
        "body": "客户合同、银行账户授权资料及完整平台账户清单相互核对；历史三期仅涉及上述两户。C转M为同一平台内部转账，不能据此认作对外投资支出。"
      }
    ],
    "pdfHref": "./assets/materials/D06.pdf",
    "nativeHref": "./assets/materials/D06.xlsx"
  },
  {
    "id": "D07",
    "title": "账户交易明细（C户）",
    "issuer": "澄川银行",
    "date": "4月1日",
    "number": "HC-C-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "完整交易明细",
        "headers": [
          "记账日期",
          "交易流水号",
          "交易对方",
          "摘要",
          "收入金额",
          "支出金额",
          "交易后余额"
        ],
        "rows": [
          [
            "1月1日",
            "IN-101",
            "丙",
            "认购本金",
            12000,
            0,
            12000
          ],
          [
            "1月31日",
            "PAY-101",
            "周岚",
            "经营收益",
            0,
            4800,
            7200
          ],
          [
            "1月31日",
            "PAY-102",
            "陈岳",
            "经营收益",
            0,
            3200,
            4000
          ],
          [
            "1月31日",
            "TRF-101",
            "金鼎财富M户",
            "内部划转",
            0,
            4000,
            0
          ],
          [
            "2月1日",
            "IN-201",
            "丁",
            "认购本金",
            10000,
            0,
            10000
          ],
          [
            "2月28日",
            "PAY-201",
            "周岚",
            "经营收益",
            0,
            4800,
            5200
          ],
          [
            "2月28日",
            "PAY-202",
            "陈岳",
            "经营收益",
            0,
            3200,
            2000
          ],
          [
            "2月28日",
            "TRF-201",
            "金鼎财富M户",
            "内部划转",
            0,
            2000,
            0
          ],
          [
            "3月1日",
            "IN-301",
            "戊",
            "认购本金",
            9000,
            0,
            9000
          ],
          [
            "3月31日",
            "PAY-301",
            "周岚",
            "经营收益",
            0,
            4800,
            4200
          ],
          [
            "3月31日",
            "PAY-302",
            "陈岳",
            "经营收益",
            0,
            3200,
            1000
          ],
          [
            "3月31日",
            "TRF-301",
            "金鼎财富M户",
            "内部划转",
            0,
            1000,
            0
          ]
        ],
        "moneyCols": [
          4,
          5,
          6
        ]
      },
      {
        "kind": "text",
        "title": "账户及区间",
        "body": "账户名：金鼎财富；账号：3100 **** **** 0101。核对区间：模拟年度1月1日至3月31日。每期C户期初余额为0，表列区间全部收支，无其他入款及未列交易。"
      },
      {
        "kind": "text",
        "title": "记录说明",
        "body": "摘要为银行记账摘要，相关合同性质及付款用途可另行核对。收入和支出合计均为31,000元，区间期末余额0元。"
      }
    ],
    "pdfHref": "./assets/materials/D07.pdf",
    "nativeHref": "./assets/materials/D07.xlsx"
  },
  {
    "id": "D08",
    "title": "账户交易明细（M户）",
    "issuer": "澄川银行",
    "date": "4月1日",
    "number": "HC-M-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "完整交易明细",
        "headers": [
          "记账日期",
          "交易流水号",
          "交易对方",
          "摘要",
          "收入金额",
          "支出金额",
          "交易后余额"
        ],
        "rows": [
          [
            "1月31日",
            "TRF-101",
            "金鼎财富C户",
            "内部转入",
            4000,
            0,
            4000
          ],
          [
            "2月28日",
            "TRF-201",
            "金鼎财富C户",
            "内部转入",
            2000,
            0,
            6000
          ],
          [
            "3月31日",
            "TRF-301",
            "金鼎财富C户",
            "内部转入",
            1000,
            0,
            7000
          ]
        ],
        "moneyCols": [
          4,
          5,
          6
        ]
      },
      {
        "kind": "text",
        "title": "账户及区间",
        "body": "账户名：金鼎财富；账号：3100 **** **** 0102。区间：模拟年度1月1日至3月31日；期初0元，三期无其他收支，也未向C户回拨。"
      },
      {
        "kind": "text",
        "title": "对账信息",
        "body": "区间收入合计7,000元、支出0元、期末7,000元。内部划转执行号应与C户对应。"
      }
    ],
    "pdfHref": "./assets/materials/D08.pdf",
    "nativeHref": "./assets/materials/D08.xlsx"
  },
  {
    "id": "D09",
    "title": "存续认购及到期登记表",
    "issuer": "金鼎财富客户服务组",
    "date": "3月31日",
    "number": "JD-KH-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "客户登记",
        "headers": [
          "客户",
          "客户组",
          "合同编号",
          "存续本金",
          "月约定比例",
          "每月计算额",
          "下一到期/支付",
          "支付安排"
        ],
        "rows": [
          [
            "周岚",
            "旧客",
            "CN-ZL-OLD",
            60000,
            0.08,
            4800,
            "4月30日",
            "按月支付约定收益"
          ],
          [
            "陈岳",
            "旧客",
            "CN-CY-OLD",
            40000,
            0.08,
            3200,
            "4月30日",
            "按月支付约定收益"
          ],
          [
            "丙",
            "新客",
            "CN-B-001",
            12000,
            0.08,
            960,
            "4月1日",
            "三个月本金及累计收益同付"
          ],
          [
            "丁",
            "新客",
            "CN-D-001",
            10000,
            0.08,
            800,
            "5月1日",
            "三个月本金及累计收益同付"
          ],
          [
            "戊",
            "新客",
            "CN-W-001",
            9000,
            0.08,
            720,
            "6月1日",
            "三个月本金及累计收益同付"
          ]
        ],
        "moneyCols": [
          3,
          5
        ],
        "percentCols": [
          4
        ]
      },
      {
        "kind": "text",
        "title": "登记说明",
        "body": "丙、丁、戊认购日期分别为1月1日、2月1日、3月1日，采用8%月比例、三个月单利。旧客存续本金合计100,000元；全部客户存续本金131,000元为合同登记额，不是银行期初现金。"
      }
    ],
    "pdfHref": "./assets/materials/D09.pdf",
    "nativeHref": "./assets/materials/D09.xlsx"
  },
  {
    "id": "D10",
    "title": "收益付款批次执行指令",
    "issuer": "金鼎财富财务经办组",
    "date": "3月31日",
    "number": "JD-FK-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "批次与用途",
        "headers": [
          "指令批次",
          "签发日期",
          "来源流水号",
          "付款流水号",
          "收款人",
          "付款用途",
          "付款金额"
        ],
        "rows": [
          [
            "CMD-01",
            "1月31日",
            "IN-101",
            "PAY-101",
            "周岚",
            "旧客当期收益",
            4800
          ],
          [
            "CMD-01",
            "1月31日",
            "IN-101",
            "PAY-102",
            "陈岳",
            "旧客当期收益",
            3200
          ],
          [
            "CMD-02",
            "2月28日",
            "IN-201",
            "PAY-201",
            "周岚",
            "旧客当期收益",
            4800
          ],
          [
            "CMD-02",
            "2月28日",
            "IN-201",
            "PAY-202",
            "陈岳",
            "旧客当期收益",
            3200
          ],
          [
            "CMD-03",
            "3月31日",
            "IN-301",
            "PAY-301",
            "周岚",
            "旧客当期收益",
            4800
          ],
          [
            "CMD-03",
            "3月31日",
            "IN-301",
            "PAY-302",
            "陈岳",
            "旧客当期收益",
            3200
          ]
        ],
        "moneyCols": [
          6
        ]
      },
      {
        "kind": "text",
        "title": "执行口径",
        "body": "每批次从对应IN认购款中安排8,000元支付旧客本期收益，对客回单用途统一记为“经营收益”。执行号应与银行流水及收款回单核对。"
      },
      {
        "kind": "text",
        "title": "文书管理",
        "body": "本表为三期指令存档汇总；签发记录先于当日实际支付，经办与复核记录随原始指令存档。"
      }
    ],
    "pdfHref": "./assets/materials/D10.pdf",
    "nativeHref": "./assets/materials/D10.xlsx"
  },
  {
    "id": "D11",
    "title": "客户收益到账核对汇总",
    "issuer": "澄川银行授权核对资料",
    "date": "4月1日",
    "number": "HC-DZ-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "到账记录",
        "headers": [
          "入账日期",
          "回单编号",
          "付款流水号",
          "收款人",
          "入账金额",
          "用途",
          "记账状态"
        ],
        "rows": [
          [
            "1月31日",
            "RCPT-101",
            "PAY-101",
            "周岚",
            4800,
            "经营收益",
            "已入账"
          ],
          [
            "1月31日",
            "RCPT-102",
            "PAY-102",
            "陈岳",
            3200,
            "经营收益",
            "已入账"
          ],
          [
            "2月28日",
            "RCPT-201",
            "PAY-201",
            "周岚",
            4800,
            "经营收益",
            "已入账"
          ],
          [
            "2月28日",
            "RCPT-202",
            "PAY-202",
            "陈岳",
            3200,
            "经营收益",
            "已入账"
          ],
          [
            "3月31日",
            "RCPT-301",
            "PAY-301",
            "周岚",
            4800,
            "经营收益",
            "已入账"
          ],
          [
            "3月31日",
            "RCPT-302",
            "PAY-302",
            "陈岳",
            3200,
            "经营收益",
            "已入账"
          ]
        ],
        "moneyCols": [
          4
        ]
      },
      {
        "kind": "text",
        "title": "核对范围",
        "body": "周岚收款账号6228 **** **** 0601，陈岳收款账号6228 **** **** 0401；付款方均为金鼎财富C户。三期收款合计24,000元，记录按客户授权核对。"
      },
      {
        "kind": "text",
        "title": "回单口径",
        "body": "用途字段为付款方填写的摘要，相关经营及资金来源需结合其他资料核验。"
      }
    ],
    "pdfHref": "./assets/materials/D11.pdf",
    "nativeHref": "./assets/materials/D11.xlsx"
  },
  {
    "id": "D12A",
    "title": "4月到期付款计划表",
    "issuer": "金鼎财富客户服务组",
    "date": "3月31日",
    "number": "JD-DQ-004",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "截至3月31日编制的4月付款计划",
        "headers": [
          "支付对象",
          "项目",
          "计算依据",
          "应付金额",
          "计划支付日"
        ],
        "rows": [
          [
            "旧客组",
            "当期约定收益",
            "100,000 × 8%",
            8000,
            "4月30日"
          ],
          [
            "丙",
            "到期认购本金",
            "合同本金",
            12000,
            "4月1日"
          ],
          [
            "丙",
            "三个月累计收益",
            "12,000 × 8% × 3",
            2880,
            "4月1日"
          ]
        ],
        "moneyCols": [
          3
        ]
      },
      {
        "kind": "text",
        "title": "计划口径",
        "body": "本表于3月31日编制，列示4月不同到期日的付款计划，合计22,880元。其中丙本息14,880元计划4月1日支付，旧客组收益8,000元计划4月30日支付，并非同日应付。丁、戊分别于5月、6月到期，不列入本表。"
      }
    ],
    "pdfHref": "./assets/materials/D12A.pdf",
    "nativeHref": "./assets/materials/D12A.xlsx"
  },
  {
    "id": "D12B",
    "title": "关于体验批次付款安排的通知",
    "issuer": "金鼎财富",
    "date": "5月2日",
    "number": "JD-TZ-005",
    "type": "notice",
    "blocks": [
      {
        "kind": "text",
        "title": "付款通知",
        "body": "因系统升级，部分体验批次付款延迟。对5月2日前已入账、且本次提交退出申请的体验本金，当前批次按既有本金50%安排处理，剩余部分待后续通知。"
      },
      {
        "kind": "text",
        "title": "新增认购",
        "body": "经理表示，追加资金可申请优先通道。该申请安排不附独立支付保证；5月2日新入金不纳入本次既有本金50%处理批次。"
      },
      {
        "kind": "text",
        "title": "办理方式",
        "body": "客户经七号柜台提交申请，资料核对后以实际银行入账为准。继续持有者本次不办理退出支付。系统服务咨询与交易资料申请分别登记。"
      },
      {
        "kind": "text",
        "title": "公告范围",
        "body": "本通知只涉及当前体验批次。历史项目账及此前到期计划，按各自截止日资料查阅。"
      }
    ],
    "pdfHref": "./assets/materials/D12B.pdf",
    "nativeHref": "./assets/materials/D12B.docx"
  },
  {
    "id": "D13",
    "title": "历史截止日资金与项目资产核对表",
    "issuer": "项目授权资料核对组",
    "date": "4月1日",
    "number": "HY-ZC-003",
    "type": "spreadsheet",
    "blocks": [
      {
        "kind": "table",
        "title": "资金及资产",
        "headers": [
          "核对项目",
          "账面/登记依据",
          "可核实金额",
          "单位"
        ],
        "rows": [
          [
            "C户余额",
            "银行区间流水",
            0,
            "元"
          ],
          [
            "M户余额",
            "银行区间流水",
            7000,
            "元"
          ],
          [
            "其他银行账户",
            "完整账户清单",
            0,
            "元"
          ],
          [
            "JD-01可核实项目资产",
            "完整项目清单及核验",
            0,
            "元"
          ],
          [
            "其他实际执行项目资产",
            "完整对应账簿",
            0,
            "元"
          ]
        ],
        "moneyCols": [
          2
        ]
      },
      {
        "kind": "table",
        "title": "其他核对事项",
        "headers": [
          "事项",
          "核对结果"
        ],
        "rows": [
          [
            "已生效外部融资承诺",
            "无"
          ],
          [
            "JD-01三期实际经营利润",
            "0元"
          ],
          [
            "核验截止日",
            "模拟年度3月31日"
          ],
          [
            "完整范围",
            "C、M两户及完整项目与资产清单"
          ]
        ]
      },
      {
        "kind": "text",
        "title": "口径说明",
        "body": "可核实资金及项目资产合计7,000元。该数字为3月31日截止状态，不涵盖此后发生的交易。未入账的新客户资金不列作已拥有资金；付款义务见相同截止日编制的到期表。"
      }
    ],
    "pdfHref": "./assets/materials/D13.pdf",
    "nativeHref": "./assets/materials/D13.xlsx"
  }
];

export const DOCUMENT_MAP = Object.fromEntries(DOCUMENTS.map(doc => [doc.id, doc]));

export const ROUTES = [
  {
    id: 'business', title: '业务核验', subtitle: '核对项目披露与实际业务',
    shallowDocs: ['D04'], deepDocs: ['D05'],
  },
  {
    id: 'funds', title: '资金追踪', subtitle: '核对账户、认购及资金流向',
    shallowDocs: ['D06'], deepDocs: ['D07', 'D08'],
  },
  {
    id: 'payouts', title: '收益核对', subtitle: '核对付款安排与实际到账',
    shallowDocs: ['D09'], deepDocs: ['D10', 'D11'],
  },
];

const officeNumber = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const officePercent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 });
const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => htmlEntities[char]);

function renderCell(value, column, block) {
  const isMoney = (block.moneyCols || []).includes(column);
  const isPercent = (block.percentCols || []).includes(column);
  const numeric = typeof value === 'number' && Number.isFinite(value);
  let shown = value;
  if (numeric && isMoney) shown = officeNumber.format(value);
  else if (numeric && isPercent) shown = officePercent.format(value);
  return `<td${numeric ? ' class="document-numeric"' : ''}>${escapeHtml(shown)}</td>`;
}

/** Real text and tables, with no player-facing answer annotations or app controls. */
export function renderDocument(doc) {
  if (!doc) return '';
  const sections = (doc.blocks || []).map(block => {
    const heading = block.title ? `<h2>${escapeHtml(block.title)}</h2>` : '';
    if (block.kind === 'table') {
      const headers = (block.headers || []).map(value => `<th scope="col">${escapeHtml(value)}</th>`).join('');
      const rows = (block.rows || []).map(row => `<tr>${row.map((value, column) => renderCell(value, column, block)).join('')}</tr>`).join('');
      return `<section class="document-section">${heading}<div class="document-table-wrap" tabindex="0" role="region" aria-label="${escapeHtml(block.title || '资料表格')}"><table class="document-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    return `<section class="document-section">${heading}<p>${escapeHtml(block.body)}</p></section>`;
  }).join('');
  return `<article class="document-paper" lang="zh-CN" data-document="${escapeHtml(doc.id)}"><header class="document-header"><p class="document-issuer">${escapeHtml(doc.issuer)}</p><h1>${escapeHtml(doc.title)}</h1><dl class="document-meta"><div><dt>编号</dt><dd>${escapeHtml(doc.number)}</dd></div><div><dt>日期</dt><dd>模拟年度${escapeHtml(doc.date)}</dd></div></dl></header>${sections}</article>`;
}
