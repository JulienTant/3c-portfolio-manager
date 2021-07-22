import React, { PureComponent } from 'react';
// import { Consumer } from '../../Context';

import { Button, ButtonGroup } from '@material-ui/core';
import SyncIcon from '@material-ui/icons/Sync';

import { RiskMonitor, SummaryStatistics, PerformanceMonitor, ActiveDeals } from './Views';

import Card from '../Charts/DataCards/Card';


import './Stats.scss'

/**
 * TODO 
 * - Need to add a date filter that can filter the Risk / Performance dashboards.
 * 
 * 
 */

const buttonElements = [
    {
        name: 'Summary Statistics',
        id: 'summary-stats'
    },
    {
        name: 'Risk Monitor',
        id: 'risk-monitor'
    },
    {
        name: 'Performance Monitor',
        id: 'performance-monitor'
    },
    {
        name: 'Active Deals',
        id: 'active-deals'
    }
]

/**
 * TODO 
 * - Need to add a date filter that can filter the Risk / Performance dashboards.
 * 
 * 
 */
class Stats extends PureComponent {

    state = {
        dealData: [],
        activeDeals: [],
        accountData: [],
        performanceData: [],
        balance: {
            on_orders: 0,
            position: 0,
            sum: 0
        },
        metrics: {
            activeSum: 0,
            maxRisk: 0,
            totalProfit: 0,
            maxRiskPercent: 0,
            bankrollAvailable: 0
        },
        currentView: 'summary-stats'
    }

    fetchDealData = async () => {
        let dataArray = await electron.database.query("select final_profit, closed_at, id from deals where closed_at != null or closed_at != '@closed_at' or finished = 1 order by closed_at asc;")
        let dates = Array.from(new Set(dataArray.map(row => { if (row.closed_at) { return row.closed_at.split('T')[0] } })))

        let profitArray = []

        dates.forEach((day, index) => {
            let profit = dataArray.filter(deal => deal.closed_at.split('T')[0] === day).map(deal => deal.final_profit)
            if (profit.length > 0) {
                profit = profit.reduce((sum, profit) => sum + profit)
            } else {
                profit = 0
            }

            let runningSum = (index == 0) ? +profit : profitArray[index - 1].runningSum + +profit
            let dateObject = {
                'utc_date': day,
                'profit': +profit.toFixed(6),
                runningSum: +runningSum.toFixed(6)
            }
            profitArray.push(dateObject)
        })

        this.setState({
            dealData: profitArray,
            metrics: {
                totalProfit: profitArray[profitArray.length - 1].runningSum.toLocaleString(undefined, { 'minimumFractionDigits': 0, 'maximumFractionDigits': 0 })
            }
        })

    }

    /**
     * TODO
     * - Does this need to be everything, or just things that are not null?
     */
    fetchPerformanceData = async () => {
        // Filtering by only closed.
        // This can most likely be moved to the performance dashboard or upwards to the app header.

        const queryString = `
                    SELECT 
                        bot_id || '-' || pair as performance_id, 
                        bot_name, 
                        pair,
                        avg(profitPercent) as averageHourlyProfitPercent, 
                        sum(final_profit) as total_profit, 
                        count(*) as number_of_deals,
                        sum(bought_volume) as bought_volume,
                        avg(deal_hours) as averageDealHours
                    FROM 
                        deals 
                    WHERE
                        profitPercent is not null
                    GROUP BY 
                        performance_id;`

        let databaseQuery = await electron.database.query(queryString)
        console.log(databaseQuery)

        const totalProfitSummary = databaseQuery.map(deal => deal.total_profit).reduce((sum, item) => sum + item)
        const boughtVolumeSummary = databaseQuery.map(deal => deal.bought_volume).reduce((sum, item) => sum + item)

        const performanceData = databaseQuery.map(perfData => {

            const { bought_volume, total_profit } = perfData

            return {
                ...perfData,
                percentTotalVolume: (bought_volume / boughtVolumeSummary) * 100,
                percentTotalProfit: (total_profit / totalProfitSummary) * 100,
            }
        })

        console.log({ totalProfitSummary, boughtVolumeSummary })
        console.log(performanceData)
   


        this.setState({
            performanceData
        })

    }

    // Responsible for syncing with 3C on the most recently update deeals in desc order.
    updateDatabase = async () => {
        await electron.api.update();
    }

    getActiveDeals = async () => {
        let activeDeals = await electron.database.query("select * from deals where finished = 0 ")

        if (activeDeals.length > 0) {
            activeDeals = activeDeals.map(row => {
                const so_volume_remaining = row.max_deal_funds - row.bought_volume
                return {
                    ...row,
                    so_volume_remaining
                }
            })

            console.log(activeDeals)
            this.setState(prevState => {
                return ({
                    activeDeals,
                    metrics: {
                        ...prevState.metrics,
                        activeSum: activeDeals.map(deal => deal.bought_volume).reduce((sum, item) => sum + item),
                        maxRisk: activeDeals.map(deal => deal.max_deal_funds).reduce((sum, item) => sum + item)
                    }
                })
            })

        }
    }

    getAccountData = async () => {
        let accountData = await electron.database.query("select * from accountData")

        let defaultCurrency = this.props.config.general.defaultCurrency
        let balanceData = accountData.filter(row => row.currency_code === defaultCurrency)[0]

        this.setState({
            accountData,
            balance: {
                on_orders: balanceData.on_orders,
                position: balanceData.position,
                sum: ((balanceData.on_orders + balanceData.position))
            }
        })
    }

    calculateMetrics = async () => {
        this.setState(prevState => {
            return ({
                metrics: {
                    ...prevState.metrics,
                    maxRiskPercent: ((parseInt(prevState.metrics.maxRisk) / (parseInt(prevState.balance.sum) + parseInt(prevState.metrics.activeSum))) * 100).toFixed(0),
                    bankrollAvailable: ((parseInt(prevState.balance.sum) / (parseInt(prevState.balance.sum) + parseInt(prevState.metrics.activeSum))) * 100).toFixed(0)
                }
            })
        })
    }

    parseNumber = (number) => {
        if (number) {
            return number.toLocaleString(undefined, { 'minimumFractionDigits': 0, 'maximumFractionDigits': 0 })
        }
        return number
    }

    viewChanger = (currentView) => {

        console.log(currentView)
        this.setState({ currentView })
    }

    currentView() {
        const currentView = this.state.currentView
        if (currentView === 'risk-monitor') {
            return <RiskMonitor activeDeals={this.state.activeDeals} metrics={this.state.metrics} balance={this.state.balance} />
        } else if (currentView === 'performance-monitor') {
            return <PerformanceMonitor performanceData={this.state.performanceData} />
        } else if (currentView === 'active-deals') {
            return <ActiveDeals />
        }

        return <SummaryStatistics dealData={this.state.dealData} />
    }




    componentDidMount = async () => {
        await this.fetchDealData()
        await this.fetchPerformanceData()
        await this.getActiveDeals()
        await this.getAccountData()
        await this.calculateMetrics()
        console.log(this.state)

    }


    render() {
        return (
            <div className="mainWindow">
                <h1>Stats</h1>
                <div className="flex-row padding">
                    <Button
                        variant="outlined"
                        onClick={() => this.componentDidMount()}
                        endIcon={<SyncIcon />}
                    >
                        {/* Need to make this pull the data, but the data control needs to be a bit higher up. */}
                        Query Database
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => this.updateDatabase()}
                        endIcon={<SyncIcon />}
                    >
                        Update 3C
                    </Button>
                </div>

                <div className="flex-column" style={{ alignItems: 'center' }}>
                    {/* <h2>Views:</h2> */}

                    {/* This needs to be it's own div to prevent the buttons from taking on the flex properties. */}
                    <div>
                        <ButtonGroup aria-label="outlined primary button group" disableElevation disableRipple>
                            {
                                buttonElements.map(button => {
                                    if (button.id === this.state.currentView) return <Button onClick={() => this.viewChanger(button.id)} color="primary" >{button.name}</Button>
                                    return <Button onClick={() => this.viewChanger(button.id)} >{button.name}</Button>

                                })
                            }
                        </ButtonGroup>
                    </div>
                </div>


                <div className="riskDiv">
                    <Card title="Active Deals" metric={this.state.activeDeals.length} />
                    <Card
                        title="$ In Deals"
                        metric={"$" + this.parseNumber(this.state.metrics.activeSum)}
                    />
                    <Card title="DCA Max" metric={"$" + this.parseNumber(this.state.metrics.maxRisk)} />
                    <Card title="Remaining Bankroll" metric={"$" + this.parseNumber((this.state.balance.position - this.state.balance.on_orders))} />
                    <Card title="Total Profit" metric={"$" + this.parseNumber(this.state.metrics.totalProfit)} />

                </div>

                {
                    this.currentView()
                }



            </div>


        )

    }

}

export default Stats;