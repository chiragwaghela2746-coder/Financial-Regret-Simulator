AI service: http://localhost:8000
POST /simulate
Req: {monthlyIncome,monthlyExpenses,savings,goals:[{name,amount,targetMonths}],purchase:{name,price,mode:"full"|"emi",emiMonths?,interestRate?}}
Res: {regretScore:0-100,scenarios:[{type:"buy_now"|"wait"|"cheaper",goals:[{name,delayMonths:number|null,onTimeProbability:0-1}]}],explanation:string}
Rules: INR; interestRate = annual %; EMI fields required if mode="emi"; null delay = not reached in 60 months; invalid input = 422
