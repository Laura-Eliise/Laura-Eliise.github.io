let getId = `query ($login: String) {
    user(where: {login: {_eq: $login}}) {
      id
    }
}`
let getTasks = `query ($login: String!) {
    progress(
        order_by: {updatedAt: asc}, 
        where: {
            user: {login: {_eq: $login}}
            isDone: {_eq: true},
            path: {_regex: "div-01/(?!piscine-js/)"}
        }
    ) {
        object {
            name
        }  
        updatedAt
    }
}`
let getTaskXP = `query ($login: String!, $task: String!) {
	transaction(
        where: {
            user: {login: {_eq: $login}},
            object: {name: {_eq: $task}},
            type:{_eq: "xp"}
        },
        order_by: {amount: desc_nulls_last}
    ) {
        amount
    }
}`
let getSkills = `query ($login: String, $offset: Int!) {
    transaction(
        where: {
            user: {login: {_eq: $login}}, 
            type: {_regex: "skill_"}
        }
        offset: $offset
        limit: 50
    ) {
        amount
        type
    }
}`

var line = new Chartist.Line('#lineGraph', {} , {
    low: 0,
    showArea: true,
    axisX: {
        type: Chartist.FixedScaleAxis,
        divisor: 7,
        labelInterpolationFnc: function(raw) {
            return moment(raw).format('MMM YY')
        },
        showGrid: false
    },
    axisY: {
        labelInterpolationFnc: function(raw) {
            if (raw >= 1000000) return `${raw/1000000}MB`
            if (raw == 0) return raw
            return `${raw /1000}KB`
        }
    }
})
var bar = new Chartist.Bar('#barGraph', {}, {
    seriesBarDistance: 10,
    reverseData: true,
    horizontalBars: true,
    axisY: {
        offset: 70,
        showGrid: false
    }
})


document.getElementById('wrapper').style.height = `${window.innerHeight - 40}px`
$('#search').on("keypress", async (e) => {
    $('#search').removeClass("error")
    $('#loading').text('Look up others')
    if (e.key === "Enter") {
        let text = $('#search').val()
        // $('#search').val('')
        $('#loading').text('Loading...') 

        // Search that user
        let resp = await setData(text)
        console.log(resp)
        if (resp === 'error') {
            $('#loading').text(`${text} does not exits`) 
            $('#search').addClass("error")
        }
    }
})

const setData = async (username = "Laura-Eliise") => {
    if (await verifyUser(username) === 'error') return 'error'
    FillBasicInfo({
        username: 'Loading...',
        level: 'Loading...',
        xp: 'Loading...'
    })

    let resp = await fetchLevelsAndXP(username)
    let data = await fetchSkills(username)

    FillBasicInfo({
        username: username, 
        level: resp.level, 
        xp: resp.xp
    })
    setGraphs(resp.data, data)
}


const verifyUser = async username => {
    let resp = (await fetchInfo(getId, {login: username})).user
    return resp.length === 0 ? 'error' : username
}

// returns the XP and Level of the user. It also returns the data 
// that will be used to create the progress overtime graph 
const fetchLevelsAndXP = async username => {
    let xp = 0
        level = 0
    let tasks = (await fetchInfo(getTasks, {login: username})).progress
    let data = {series: [], dates: []}

    // fetching each tasks xp
    for (let i in tasks) {
        let task = tasks[i]
        let variable = {login: username, task: task.object.name}
        let xpAmount = (await fetchInfo(getTaskXP, variable)).transaction[0].amount

        data.dates.push(new Date(task.updatedAt))
        i-1 > 0 ? data.series.push(xpAmount + data.series[i-1]) : data.series.push(xpAmount)
        xp += xpAmount
    }

    // Credit to Olaroll#2208 on discord for discovering/creating
    // the formula for finding the users level level
    while (Math.round(level *(176+3 *level *(47+11*level))) < xp) level++

    return {xp: xp, level: level-1, data: data}
}

const fetchSkills = async username => {
    let raw = {},
        data = {series: [], labels: []}
    let variables = {
        login: username,
        offset: 0
    }

    // fetches and adds up all the skills of the user
    while (true) {
        let resp = (await fetchInfo(getSkills, variables)).transaction
        if (resp.length == 0) break
        resp.forEach(task => {
            if (!raw[task.type]) raw[task.type] = task.amount
            else raw[task.type] += task.amount 
        })
        variables.offset += 50
    }

    for (let [longLabel, amount] of Object.entries(raw)) {
        let label = longLabel.replace('skill_', '')
        data.series.push(amount)
        data.labels.push(label)
    }

    return data
}

// filling general info
const FillBasicInfo = async data => {
    $('#name').text(`${data.username}`)
    $('#level').text(`${data.level}`)
    $('#xp').text(`${data.xp}`)
}


const setGraphs = async (lineData, barData) => {
    // progress overtime chart
    line.update({
        series: [{
            data: lineData.series.map((xp, i) => {
                return {
                    x: lineData.dates[i],
                    y: xp
                } 
            })
        }]
    })

    // bar chart of skills
    bar.update({
        series: [barData.series],
        labels: barData.labels
    })
}


// fetching info from the api
const fetchInfo = async (query, variables) => {
    return fetch('https://01.kood.tech/api/graphql-engine/v1/graphql', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    }).then((res) => res.json()).then((result) => {
        if ("error" in result) throw result.errors
        return result['data']
    });
}

setData()