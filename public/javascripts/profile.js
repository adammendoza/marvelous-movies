const checkIfFollowing = async () => {
   const button = document.getElementsByClassName('follow-btn')[0] 
   const res = await fetch(`/feed/follow/${button.id}`)
    const json = await res.json(res)
    
    if(json != null){
       button.innerHTML = 'unfollow'
       button.classList.add('class', 'unfollow')
    } else {
       button.innerHTML = 'follow'
       button.classList.add('class', 'follow')
    }
    
}

document.addEventListener('DOMContentLoaded', async () => {
   checkIfFollowing()
   const button = document.getElementsByClassName('follow-btn')[0]
   button.addEventListener('click', async (event) => {
      const classArr = Array.from(event.target.classList)
      if(classArr.includes('unfollow')){
         const res = await fetch(`/feed/follow/${button.id}/delete`, {
            method: 'DELETE'
         })
         button.classList.remove('unfollow')
         checkIfFollowing()
      } else if (classArr.includes('follow')){
         const body = button.id
         try {
            const res = await fetch('/feed/follow/new', {
               method:'POST',
               body: JSON.stringify({body}),
               headers: {
                  "Content-Type": "application/json"
               }
            })
            button.classList.remove('follow')
            checkIfFollowing()
         } catch (error) {
            console.log(error)
         }
      }
   })
   
})