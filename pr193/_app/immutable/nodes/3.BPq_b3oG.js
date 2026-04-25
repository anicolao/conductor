import{A as e,B as t,F as n,I as r,J as i,R as a,T as o,V as s,X as c,_ as l,c as u,d,g as f,h as p,j as m,q as h,r as g,v as _,x as v,y,z as b}from"../chunks/BPPyitxZ.js";import{c as x}from"../chunks/DsAOgFYg.js";import"../chunks/v_jBEYI6.js";import{a as S,r as C}from"../chunks/6mRxH2fI.js";var w=v(`<p>Loading approval queue...</p>`),T=v(`<p class="error svelte-sv3efk"> </p>`),E=v(`<p>No items currently in Human Review.</p>`),D=v(`<tr><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"><a class="view-link svelte-sv3efk">View & Approve</a></td></tr>`),O=v(`<table class="svelte-sv3efk"><thead><tr><th class="svelte-sv3efk">Issue</th><th class="svelte-sv3efk">Repository</th><th class="svelte-sv3efk">Title</th><th class="svelte-sv3efk">Action</th></tr></thead><tbody></tbody></table>`),k=v(`<div class="container svelte-sv3efk"><nav class="svelte-sv3efk"><a class="svelte-sv3efk">← Back to Dashboard</a></nav> <h1 class="svelte-sv3efk">Approval Queue</h1> <!></div>`);function A(v,A){i(A,!0);let j=s(b([])),M=s(!0),N=s(null);g(async()=>{let e=C();if(!e){S();return}try{let n=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
			query ProjectItems($org: String!, $number: Int!) {
				organization(login: $org) {
					projectV2(number: $number) {
						items(first: 100) {
							nodes {
								id
								status: fieldValueByName(name: "Status") {
									... on ProjectV2ItemFieldSingleSelectValue {
										name
										optionId
									}
								}
								content {
									... on Issue {
										number
										title
										repository {
											nameWithOwner
											owner { login }
											name
										}
									}
								}
							}
						}
					}
				}
			}
		`,variables:{org:`LLM-Orchestration`,number:1}})})).json();if(n.errors)throw Error(n.errors[0].message);let r=n.data.organization.projectV2.items.nodes;t(j,r.filter(e=>e.status?.optionId===`0fd775be`&&e.content?.number),!0)}catch(e){console.error(e),t(N,e.message,!0)}finally{t(M,!1)}});var P=k();d(`sv3efk`,t=>{e(()=>{n.title=`Approval Queue - Conductor`})});var F=r(P),I=r(F);c(F);var L=a(F,4),R=e=>{y(e,w())},z=e=>{var t=T(),n=r(t,!0);c(t),m(()=>_(n,o(N))),y(e,t)},B=e=>{y(e,E())},V=e=>{var t=O(),n=a(r(t));p(n,21,()=>o(j),f,(e,t)=>{var n=D(),i=r(n),s=r(i);c(i);var l=a(i),d=r(l,!0);c(l);var f=a(l),p=r(f,!0);c(f);var h=a(f),g=r(h);c(h),c(n),m(()=>{_(s,`#${o(t).content.number??``}`),_(d,o(t).content.repository.nameWithOwner),_(p,o(t).content.title),u(g,`href`,`${x??``}/approval/${o(t).content.repository.owner.login??``}/${o(t).content.repository.name??``}/${o(t).content.number??``}`)}),y(e,n)}),c(n),c(t),y(e,t)};l(L,e=>{o(M)?e(R):o(N)?e(z,1):o(j).length===0?e(B,2):e(V,-1)}),c(P),m(()=>u(I,`href`,`${x??``}/`)),y(v,P),h()}export{A as component};