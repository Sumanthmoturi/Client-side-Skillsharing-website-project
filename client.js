//Client side program


//1.Actions:-
function handleAction(state, action) {             // Function to handle state and actions
  if (action.type == "setUser") {                  // When the user updates/set their name
    localStorage.setItem("userName", action.user); // Store updated username in localStorage
    return {...state, user: action.user};
  } else if (action.type == "setTalks") {          // When new talks are set from the server
    return {...state, talks: action.talks};        // Return a new state with updated talks
  } else if (action.type == "newTalk") {           // When a new talk is submitted
    fetchOK(talkURL(action.title), {
      method: "PUT", 
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        presenter: state.user, 
        summary: action.summary 
      })
    }).catch(reportError);                         // Catch and report any errors
  } else if (action.type == "deleteTalk") {        // When a talk is deleted
    fetchOK(talkURL(action.talk), {method: "DELETE"})
      .catch(reportError); 
  } else if (action.type == "newComment") {        // When a new comment is added to a talk
    fetchOK(talkURL(action.talk) + "/comments", {
      method: "POST",                              // Send POST request to add the comment
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        author: state.user,   
        message: action.message
      })
    }).catch(reportError);
  }
  return state;                                    // Return updated state after action is processed
}

  function talkURL(title) {                        // Helper function to build the talk URL
    return "talks/" + encodeURIComponent(title);   // Encode title to make it URL-safe
  }
  
  
  function reportError(error) {                    //Function to handle errors and report them
    alert(String(error));
  }
  


  //2.Rendering the components
  function renderUserField(name, dispatch) {       //Function to render the input field for the user's name
    return elt("label", {}, "Your name: ", elt("input", {
      type: "text",
      value: name,                                  // Return a label and input field to allow the user to change their name
      onchange(event) {
        dispatch({type: "setUser", user: event.target.value});
      }
    }));
  }
  function elt(type, props, ...children) {          // Helper function to create DOM elements
    let dom = document.createElement(type);
    if (props) Object.assign(dom, props);           // Assign attributes to the element
    for (let child of children) {
      if (typeof child != "string") dom.appendChild(child); 
      else dom.appendChild(document.createTextNode(child));
    }
    return dom;
  }
  function renderTalk(talk, dispatch) {                   //Function to render a talk and its comments
    return elt(
      "section", {className: "talk"},
      elt("h2", null, talk.title, " ", elt("button", {
        type: "button",
        onclick() {
          dispatch({type: "deleteTalk", talk: talk.title}); // Dispatch "deleteTalk" action on click
        }
      }, "Delete")),
      elt("div", null, "by ", elt("strong", null, talk.presenter)), // Show the presenter of the talk
      elt("p", null, talk.summary),                                 // Show the talk summary
      ...talk.comments.map(renderComment),                          // Render all comments under the talk
      elt("form", {                                                 // Form to add new comments
        onsubmit(event) {
          event.preventDefault();
          let form = event.target;
          dispatch({type: "newComment", talk: talk.title, message: form.elements.comment.value}); // Dispatch new comment action
          form.reset();                                             // Clear the input field after submission
        }
      }, elt("input", {type: "text", name: "comment"}), " ",
         elt("button", {type: "submit"}, "Add comment"))); 
    }
  function renderComment(comment) {                // Function to render a single comment
    return elt("p", {className: "comment"},
               elt("strong", null, comment.author),// Return a paragraph element showing the comment's author and message
               ": ", comment.message);
  }
  function renderTalkForm(dispatch) {             // Function to render the form for submitting a new talk
    let title = elt("input", {type: "text"});     // Input field for the talk's title
    let summary = elt("input", {type: "text"});   // Input field for the talk's summary
    return elt("form", {                          // Form to submit a new talk
      onsubmit(event) {
        event.preventDefault();
        dispatch({type: "newTalk", title: title.value, summary: summary.value}); // Dispatch "newTalk" action
        event.target.reset();
      }
    }, elt("h3", null, "Submit a Talk"),
       elt("label", null, "Title: ", title), // Label for the title field
       elt("label", null, "Summary: ", summary), // Label for the summary field
       elt("button", {type: "submit"}, "Submit")); // Submit button
  }
  


//3.Polling Mechanism
  async function pollTalks(update) {         // Function for polling server for talks and updating the state when they change
    let tag = undefined;                     // ETag to track if content has changed
    for (;;) {                               // Infinite loop to continuously poll the server
      let response;
      try {
        response = await fetchOK("/talks", {
          headers: tag && {"If-None-Match": tag, "Prefer": "wait=90"}
        });
      } catch (e) {
        console.log("Request failed: " + e);
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      if (response.status == 304) continue;
      tag = response.headers.get("ETag");    // Save new ETag from response
      update(await response.json());         // Parse the response as JSON and pass it to the update callback
    }
  }
  


//4.The Application
  var SkillShareApp = class SkillShareApp {  // The main SkillShareApp class to tie everything together
    constructor(state, dispatch) {
      this.dispatch = dispatch;              // Store the dispatch function to handle actions
    this.talkDOM = elt("div", {className: "talks"}); // Container for the list of talks
    this.dom = elt("div", null,
                   renderUserField(state.user, dispatch), // Render the input field for the user's name
                   this.talkDOM,                          // Placeholder for talks
                   renderTalkForm(dispatch));             // Render the form to submit new talks
    this.syncState(state);                                // Sync the current state with the UI
  }
  syncState(state) {                                      // Method to sync the UI with the current state
    if (state.talks != this.talks) {                      // If talks have changed, update the DOM
      this.talkDOM.textContent = "";                      // Clear the existing talks
      for (let talk of state.talks) {                     // Render each talk and append it to the DOM
        this.talkDOM.appendChild(renderTalk(talk, this.dispatch));
      }
      this.talks = state.talks;                           // Update the local copy of talks
    }
  }
}
  


//5.Running the App
function runApp() {                      // Function to initialize and run the app
  let user = localStorage.getItem("userName") || "Anon"; 
  function dispatch(action) {            // Dispatch function to handle actions and update the app state
    state = handleAction(state, action); // Update state based on the action
    app.syncState(state);                // Sync the UI with the new state
  }
  pollTalks(talks => {    // Start polling the server for talks and update the app state when they change
    if (!app) {           // If the app has not been created yet
      state = {user, talks};
      app = new SkillShareApp(state, dispatch);
      document.body.appendChild(app.dom);
    } else {
      dispatch({type: "setTalks", talks});
    }
  }).catch(reportError); 
}
runApp();