each container/module should have their own claude.md


dependency - this is shown on the diagram

names will be controllers, services, load balancers, infra, database, failover databases etc... consider both infrastructure and code. Ignore config files and more granular pieces of code. emphasize togetherness by cluster.

{[name]: [
    what would get affected,
    type
    name
    description/summary/rag
    stack_keywords,
    recurring_issue: []
    ... more metadata ...
]}

Objects, schemas etc... should not be included these are their own thing but should not appear in diagram. Supporting role

issue = {
    outage,
    ticket
}

outage {
type: outage | ticket
names of services related to issue[]
resolved: date
title
summary
conversation[],
}[]

outage: {
    filtered logs/relevent logs
    link to all logs
}


solved = []

prs = {
    name: pr{}
}

pr = {
    name
    description
    passed pipeline
    comments: comment[]
    asignee: author
    coauthors: author[]
    commits
    affects: [],
    resolved: Date
}

comment: {
    post: ""
    conversation[],
    resolved: date
}

author {
    link to profile
    name
    profile picture
    timezone
}