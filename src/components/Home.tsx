/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, { FrameContext } from "@farcaster/frame-sdk";
import Image from "next/image";
import RAGameContext from "./RAGameContext";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { Button } from "./ui/Button";
import { Database } from "../../supabase";

const openAiApiKey = process.env.NEXT_PUBLIC_API_AIRSTACK || ''; // TODO: public isn't right here but yolo 
const supabaseApiKey = process.env.NEXT_PUBLIC_API_SUP || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4Y3N6eW14aW9mYW9qeXFtenl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5ODc2MjQsImV4cCI6MjA0NzU2MzYyNH0.xvaDCRZvHr5qpHJGZbWOie9XO5x2cH2EfNeMvf8Hy1g';    // TODO: public isn't right here but yolo 

// Define the Supabase client
const supabase = createClient<Database>(
  'https://tjftzpjqfqnbtvodsigk.supabase.co',
  supabaseApiKey
);

export default function Demo() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext | undefined>(undefined);
  const [selectedTab, setSelectedTab] = useState("matches");  // To manage selected tab
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTFN, setErrorTFN] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [gameContext, setGameContext] = useState<any>(null);
  const [eventsFetched, setEventsFetched] = useState(false); 
  const [fantasyData, setFantasyData] = useState<any[]>([]);
  const [loadingFantasy, setLoadingFantasy] = useState<boolean>(false);
  const [errorFantasy, setErrorFantasy] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [selectedFantasyRow, setSelectedFantasyRow] = useState<any>(null);  
  const [falseNineContent, setFalseNineContent] = useState<{ title: string, content: string, link: string, author: string, image: string, pubDate: string }[]>([]);
  const [loadingTFN, setLoadingTFN] = useState(false);

  const apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'; // ESPN Soccer API endpoint

  useEffect(() => {
    const load = async () => {
      const ctx = await sdk.context;
      setContext(ctx);
      sdk.actions.ready();
    };

    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    if (selectedTab === "matches" && !eventsFetched) {
      const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error("Failed to fetch data");
          }

          const data = await response.json();
          setApiResponse(data);
          setEventsFetched(true); // Mark as fetched
        } catch (err) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('An unknown error occurred');
          }
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
    if (selectedTab === "falseNine") {
      fetchFalseNineContent();
    }
  }, [selectedTab]);

  useEffect(() => {
    const fetchFantasyData = async () => {
      setLoadingFantasy(true);
      setErrorFantasy(null);

      try {
        // Query the 'standings' table for 'entry_name', 'rank', 'last_name', and 'fav_team'
        const { data, error } = await supabase
          .from('standings')
          .select('entry_name, rank, last_name, fav_team');

        if (error) {
          throw error;
        }
        // Step 1: Concurrently fetch profile images for each entry with valid fid
        const updatedFantasyData = await Promise.all(
          data.map(async (entry) => {
            const { last_name, fav_team } = entry;

            // Ensure last_name is not null and is a valid number (fid)
            if (last_name && !isNaN(Number(last_name))) {
              const fid = parseInt(last_name, 10); // Ensure fid is an integer
              // Check if fid is a valid integer
              if (Number.isInteger(fid)) {
                const server = "https://hubs.airstack.xyz";
                try {
                  // Make the API call using the fid
                  const response = await axios.get(`${server}/v1/userDataByFid?fid=${fid}`, {
                    headers: {
                      "Content-Type": "application/json",
                      "x-airstack-hubs": openAiApiKey
                    }
                  });

                  // Extract pfp URL from the response
                  let pfpUrl = null;
                  let username = null;
                  const messages = response.data.messages || [];
                  for (const message of messages) {
                    if (message.data?.userDataBody?.type === 'USER_DATA_TYPE_PFP') {
                      pfpUrl = message.data.userDataBody.value;
                      //break;
                    }
                    // Check if the message is for username
                    if (message.data?.userDataBody?.type === 'USER_DATA_TYPE_USERNAME') {
                      username = message.data.userDataBody.value;
                    }
                  }
                  
                  // Step 2: Fetch team info from the 'teams' table based on fav_team
                  let teamInfo = null;
                  if (fav_team) {
                    const { data: teamData, error: teamError } = await supabase
                      .from('teams')
                      .select('name, logo')
                      .eq('id', fav_team)
                      .single(); // Assume fav_team maps to one team only

                    if (teamError) {
                      console.error("Error fetching team data", teamError);
                    } else {
                      teamInfo = teamData;
                    }
                  }

                  // If no team info, use a default team logo (defifa_spinner.gif)
                  if (!teamInfo) {
                    teamInfo = { name: 'N/A', logo: '/defifa_spinner.gif' };
                  }

                  // Return updated entry with pfpUrl and teamInfo
                  return {
                    ...entry, // Spread the existing entry data
                    pfp: pfpUrl || '/defifa_spinner.gif', // Use a fallback pfp if not found
                    team: teamInfo, // Add team info (either fetched or default)
                    manager: username || 'anon', // Add username (manager) to the entry
                  };
                } catch (e) {
                  console.error("Error fetching data from API", e);
                  return { ...entry, pfp: '/defifa_spinner.gif' }; // Fallback on error
                }
              }
            }

            // Return the entry as-is if no valid fid or last_name
            return { ...entry, pfp: '/defifa_spinner.gif', team: { name: 'N/A', logo: '/defifa_spinner.gif' }, manager: 'FID not set 🤦🏽‍♂️' };
          })
        );

        // Step 3: Set the updated fantasy data with pfp and team info
        setFantasyData(updatedFantasyData);
      } catch (err) {
        if (err instanceof Error) {
          setErrorFantasy(err.message);
        } else {
          setErrorFantasy('An unknown error occurred');
        }
      } finally {
        setLoadingFantasy(false);
      }
    };

    fetchFantasyData();
  }, []); // Fetch data when the component mounts

  const fetchUserData = async (casterFid: number) => { //TODO refactor this used for casting
    try {
      const { data, error } = await supabase
        .from('standings')
        .select('fname, rank, last_name, total, fav_team')
        .eq('last_name', String(casterFid))
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        if (data.fav_team !== null) {
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('id', data.fav_team)
            .single();

          if (teamsError) {
            throw teamsError;
          }

          const userInfo = {
            username: data.fname,
            total: data.total,
            teamName: teamsData?.name || "No team set"
          };

          setUserInfo(userInfo);
        } else {
          setUserInfo({ username: data.fname, total: data.total, teamName: "No team set" });
        }
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };
  
  const fetchFalseNineContent = async () => {
    setErrorTFN(null);
    try {
      setLoadingTFN(true);
      const response = await axios.get('https://api.paragraph.xyz/blogs/rss/@thefalsenine');
  
      // Parse the RSS content using DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, 'text/xml');
  
      // Check if there are any items in the RSS feed
      const items = xmlDoc.getElementsByTagName('item');
      if (items.length === 0) {
        setErrorTFN("No items found in the RSS feed.");
        return;
      }
  
      // Extract the title, link, pubDate, and content:encoded from each item
      const content = Array.from(items).map(item => {
        const title = item.getElementsByTagName('title')[0]?.textContent || '';
        const link = item.getElementsByTagName('link')[0]?.textContent || '';
        const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
        const contentEncoded = item.getElementsByTagName('content:encoded')[0]?.textContent || '';
        const author = item.getElementsByTagName('author')[0]?.textContent || '';
        const imageUrl = item.getElementsByTagName('enclosure')[0]?.getAttribute('url') || ''; // Get image URL from enclosure
        return {
          title,
          link,
          pubDate,
          content: contentEncoded,
          author,
          image: imageUrl
        };
      });
  
      // If no content is found, show a message
      if (content.length === 0 || content.every(c => !c.content.trim())) {
        setErrorTFN("No content available.");
      } else {
        setFalseNineContent(content); // Set the fetched and formatted content
      }
    } catch (err) {
      setErrorTFN("Failed to load content.");
      console.error('Error fetching or parsing RSS:', err);
    } finally {
      setLoadingTFN(false);
    }
  };
  
  const fetchGameContext = (homeTeam: string, awayTeam: string) => {
    setGameContext(null);
    setLoading(true);

    const eventId = `${homeTeam}${awayTeam}`;
    RAGameContext(eventId)
      .then((data) => {
        setGameContext(data);
        setLoading(false);
      })
      .catch((err) => {
        setGameContext("Failed to fetch game context " + eventId);
        setLoading(false);
        console.error("Failed to fetch game context", err);
      });
  };

  const installMiniAp = useCallback(() => {
      sdk.actions.addFrame();
  }, []);

  const castSummary = useCallback(() => {
    if (selectedMatch) {
      const { competitors, homeTeam, awayTeam, homeScore, awayScore, clock, homeLogo, awayLogo, eventStarted } = selectedMatch;
      const matchSummary = `${competitors}\n${homeTeam.toUpperCase()} ${eventStarted ? homeScore : ''} - ${eventStarted ? awayScore : ''} ${awayTeam.toUpperCase()}\n${eventStarted ? `${clock}` : `Kickoff: ${clock}`}\n\nUsing the d33m live match mini-app https://d33m-frames-v2.vercel.app cc @kmacb.eth Go ${userInfo?.teamName || 'd33m!'}`;
      const encodedSummary = encodeURIComponent(matchSummary);
      const url = `https://warpcast.com/~/compose?text=${encodedSummary}&channelKey=football&embeds[]=${homeLogo}&embeds[]=${awayLogo}`;

      sdk.actions.openUrl(url);
    }
  }, [selectedMatch, userInfo?.teamName]);

  const castFantasySummary = useCallback(() => {
    if (selectedFantasyRow) {
      const { manager, team, rank, fav_team } = selectedFantasyRow; // Get selected row data

      // Prevent casting if the manager is 'FID not set'
      console.log(manager);
      if (manager == 'FID not set 🤦🏽‍♂️') {
        return;
      }

      // Check if fav_team exists and cast the appropriate summary message
      const summary = fav_team 
        ? `FC-FEPL @${manager} supports ${team.name}. They are ranked #${rank} in the FC fantasy league.\n\nmini-app by @kmacb.eth @gabrieltemtsen et al`
        : `FC-FEPL @${manager} is currently without a favorite team. They are ranked #${rank} in the FC fantasy league.\n\nmini-app by @kmacb.eth @gabrieltemtsen et al`;

      const encodedSummary = encodeURIComponent(summary);
      const url = `https://warpcast.com/~/compose?text=${encodedSummary}&channelKey=football&embeds[]=${team.logo || ''}&embeds[]=https://d33m-frames-v2.vercel.app`;

      // Trigger the cast action using the context
      sdk.actions.openUrl(url); // Open URL with the casted summary
    }
  }, [selectedFantasyRow]);

  useEffect(() => {
    if (selectedFantasyRow) {
      castFantasySummary();  // Automatically cast when the selected row is updated
    }
  }, [selectedFantasyRow, castFantasySummary]);  // Dependency on selectedRow to trigger when it changes

  const readMatchSummary = useCallback(() => {
    if (selectedMatch) {
      const utterance = new SpeechSynthesisUtterance(gameContext);
      if (utterance && typeof utterance.rate === 'number') {
        utterance.rate = 1.5;
      }
      window.speechSynthesis.speak(utterance);
    }
  }, [gameContext, selectedMatch]);

  const renderEvent = (event: any) => {
    const homeTeam = event.shortName.split('@')[1].trim().toLowerCase();
    const awayTeam = event.shortName.split('@')[0].trim().toLowerCase();
    const competitors = event.name;
    const eventStarted = new Date() >= new Date(event.date);
    const clock = event.status.displayClock + ' ' + event.status.type.detail || '00:00';

    const homeTeamLogo = event.competitions[0]?.competitors[0]?.team.logo;
    const awayTeamLogo = event.competitions[0]?.competitors[1]?.team.logo;
    const homeScore = event.competitions[0]?.competitors[0]?.score;
    const awayScore = event.competitions[0]?.competitors[1]?.score;

    const keyMoments = event.competitions[0]?.details.reduce((acc: any[], detail: any) => {
      const playerName = (detail.athletesInvolved && detail.athletesInvolved.length > 0) 
        ? detail.athletesInvolved[0]?.displayName || 'Coaching staff'
        : 'Coaching staff';

      const action = detail.type.text; // Goal, Yellow Card, etc.
      const time = detail.clock.displayValue || '00:00';
      const teamId = detail.team.id; // Get the team id

      let teamLogo = '';
      if (teamId === event.competitions[0]?.competitors[0]?.team.id) {
        teamLogo = homeTeamLogo; // Assign home team logo if it's the home team
      } else {
        teamLogo = awayTeamLogo; // Otherwise, assign away team logo
      }

      // Process goals and goal-related actions
      if (action === "Goal" || action === "Goal - Header" || action === "Penalty - Scored" || action === "Goal - Free-kick" || action === "Own Goal") {
        // Check if the player is already in the accumulator
        const existingGoal = acc.find(item => item.playerName === playerName);

        if (existingGoal) {
          // Add the new goal time to the existing entry
          existingGoal.times.push(time);
        } else {
          // If the player is not in the accumulator, create a new entry
          acc.push({
            playerName,
            times: [time], // Initialize the times array with the first goal time
            logo: teamLogo, // Add the team logo to the entry
            action: action === "Own Goal" ? "🔴" : "⚽️" // Red ⚽️ for own goal
          });
        }
      } else {
        // For Yellow or Red cards, handle them normally
        acc.push({
          playerName,
          times: [time],
          action: action === "Yellow Card" ? "🟨" : action === "Red Card" ? "🟥" : action,
          logo: teamLogo, // Add the team logo to the entry
        });
      }

      return acc;
    }, []).map((moment: any, index: number) => {
      // Format the times for goal scorers on one line
      const formattedAction = moment.action || "⚽️"; // Default to "⚽️" for goals

      // Apply text-red for Own Goal player names
      const playerNameClass = formattedAction === "🔴" ? "text-fontRed" : "text-lightPurple"; // Apply red color to Own Goal

      return (
        <div key={index} className="text-sm text-lightPurple flex items-center">
          {/* Moment (Action Emoji) Before Player Name */}
          <span className="mr-2 font-bold">{formattedAction}</span>

          {/* Team Logo */}
          <Image
            src={moment.logo || '/assets/defifa_spinner.gif'}
            alt="Team Logo"
            className="w-6 h-6 mr-2"
            width={15}
            height={15}
          />

          {/* Player Name */}
          <span className={playerNameClass}>{moment.playerName}</span>

          {/* Times */}
          <span className="text-xs ml-1">{moment.times.join(' / ')}</span>
        </div>
      );
    });

    return (
      <div key={event.id} className="sidebar">
        <div className="hover:bg-deepPink cursor-pointer">
          <button 
            onClick={() => {
              setSelectedMatch({
                homeTeam: `${homeTeam}`,
                awayTeam: `${awayTeam}`,
                competitors: competitors,
                homeLogo: homeTeamLogo,
                awayLogo: awayTeamLogo,
                homeScore: homeScore,
                awayScore: awayScore,
                clock: clock,
                eventStarted: eventStarted,
              });
              fetchGameContext(homeTeam, awayTeam);
              fetchUserData(context?.user?.fid || 0);
            }}
            className="dropdown-button cursor-pointer flex items-center justify-center mb-2 w-full"
          >
            <span className="flex justify-center space-x-4 ml-2 mr-2">
              <div className="flex flex-col items-center space-y-1">
                <Image
                  src={homeTeamLogo || '/assets/defifa_spinner.gif'}
                  alt="Home Team Logo"
                  className="w-8 h-8"
                  width={20}
                  height={20}
                />
                <span>{homeTeam}</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                {eventStarted ? (
                  <>
                    <span className="text-white font-bold text-2xl">{homeScore} - {awayScore}</span>
                    <span className="text-lightPurple text-xs">{clock}</span> {/* Displaying the clock if the event has started */}
                  </>
                ) : (
                  <>
                    <span>Kickoff: {new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> {/* Display Start Time if event hasn't started */}
                  </>
                )}
              </div>

              <div className="flex flex-col items-center space-y-1">
                <Image
                  src={awayTeamLogo || '/assets/defifa_spinner.gif'}
                  alt="Away Team Logo"
                  className="w-8 h-8"
                  width={20}
                  height={20}
                />
                <span>{awayTeam}</span>
              </div>
            </span>
          </button>
        </div>

        {/* Display Key Moments only if match is selected and game context is available */}
        <div className="mt-2">
          {selectedMatch && gameContext ? (
            <>
              <h4 className="text-lightPurple font-semibold">Key Moments:</h4>
              {keyMoments.length > 0 ? (
                <div className="space-y-1">{keyMoments}</div>
              ) : (
                <span className="text-lightPurple">No key moments yet.</span>
              )}
            </>
          ) : (
            <span className="text-lightPurple">Select for AI summary & key moments.</span>
          )}
        </div>
      </div>
    );
  };

  if (!isSDKLoaded) return <div>Waiting for VAR...</div>;

  // If ctx is not defined, show the message to go to Purple app
  if (!context) {
    return (
      <div className="w-[375px] mx-auto py-4 px-2">
        <h2 className="text-2xl font-bold text-center text-notWhite">d33m live EPL match summaries mini-app</h2>
        <p className="text-center mt-4 text-fontRed">Open in a Farcaster app</p>
        <a href="https://warpcast.com/kmacb.eth/0xac8d7401" target="_blank" rel="noreferrer" className="block text-center mt-4 text-lightPurple underline">Go to Warpcast</a>
      </div>
    );
  }

  return (
    <div className="w-[400px] mx-auto py-4 px-2">
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto space-x-4 mb-4 sticky top-0 z-10 bg-darkPurple">
        <div
          onClick={() => setSelectedTab("matches")}
          className={`flex-shrink-0 py-1 px-6 text-sm font-semibold cursor-pointer rounded-full border-2 ${
            selectedTab === "matches" ? "border-limeGreenOpacity text-lightPurple" : "border-gray-500 text-gray-700"}`}
        >
          Matches
        </div>
        <div
          onClick={() => setSelectedTab("fantasy")}
          className={`flex-shrink-0 py-1 px-6 text-sm font-semibold cursor-pointer rounded-full border-2 ${
            selectedTab === "fantasy" ? "border-limeGreenOpacity text-lightPurple" : "border-gray-500 text-gray-700"}`}
        >
          Fantasy
        </div>
        <div
          onClick={() => setSelectedTab("falseNine")}
          className={`flex-shrink-0 py-1 px-6 text-sm font-semibold cursor-pointer rounded-full border-2 ${
            selectedTab === "falseNine" ? "border-limeGreenOpacity text-lightPurple" : "border-gray-500 text-gray-700"}`}
        >
          The False Nine
        </div>
        <div
          onClick={() => setSelectedTab("banter")}
          className={`flex-shrink-0 py-1 px-6 text-sm font-semibold cursor-pointer rounded-full border-2 ${
            selectedTab === "banter" ? "border-limeGreenOpacity text-lightPurple" : "border-gray-500 text-gray-700"}`}
        >
          Banter
        </div>
        <div
          onClick={() => setSelectedTab("players")}
          className={`flex-shrink-0 py-1 px-6 text-sm font-semibold cursor-pointer rounded-full border-2 ${
            selectedTab === "players" ? "border-limeGreenOpacity text-lightPurple" : "border-gray-500 text-gray-700"}`}
        >
          Players
        </div>
      </div>
  
      {/* Tab Content */}
      <div className="bg-darkPurple p-4 rounded-md text-white">
        {selectedTab === "matches" && (
          <div>
            <h2 className="font-2xl text-notWhite font-bold mb-4">Select match</h2>
            {/* Add your button for Matches Tab, or render your matches content here */}
            <div className="p-4 mt-2 bg-purplePanel text-lightPurple rounded-lg">
              {loading ? (
                <div>Loading match context is like waiting for VAR...</div>
              ) : error ? (
                <div className="text-red-500">{error}</div>
              ) : apiResponse ? (
                apiResponse.events.map((event: any) => renderEvent(event)) // Ensure renderEvent function works here
              ) : (
                <div>No data available.</div>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg"></h3>
              {/* Container for AI Summary and Cast Button */}
              <div className="mt-4 text-lightPurple bg-purplePanel">
                {gameContext ? (
                  <div className="p-4 bg-purplePanel text-lightPurple rounded-lg">
                    <h2 className="font-2xl text-notWhite font-bold mb-4">
                      <button onClick={readMatchSummary}>
                        {selectedMatch.eventStarted
                          ? `[AI] Match Summary  🗣️🎧1.5x`
                          : `[AI] Match Preview  🗣️🎧1.5x`}
                      </button>
                    </h2>
                    <pre className="text-sm whitespace-pre-wrap break-words">{gameContext}</pre>
                    <div className="mt-4">
                      <Button onClick={castSummary}>Cast</Button>
                    </div>
                    <div className="mt-4">
                      <Button onClick={installMiniAp}>Install mini-app</Button>
                    </div>
                  </div>
                ) : loading ? (
                  <div></div>
                ) : (
                  <div>
                    <Button onClick={installMiniAp}>Install mini-app</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
  
        {selectedTab === "fantasy" && (
          <div>
            <h2 className="font-2xl text-notWhite font-bold mb-4">Table</h2>
            {loadingFantasy ? (
              <div className="text-lightPurple">
                <div>Loading fantasy stats...</div>
                <div>
                  The longest VAR check in Premier League history was five minutes and 37 seconds long and took place during a March 2024 match between West Ham and Aston Villa.
                </div>
              </div>
            ) : errorFantasy ? (
              <div className="text-red-500">{errorFantasy}</div>
            ) : fantasyData.length > 0 ? (
              <div className="bg-purplePanel p-4 rounded-md">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-notWhite text-left px-4">Fav Club</th>
                      <th className="text-notWhite text-left px-4">Manager</th>
                      <th className="text-notWhite text-left px-4">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="text-lightPurple text-sm">
                    {fantasyData.map((entry, index) => (
                      <tr
                        key={index}
                        className="cursor-pointer hover:bg-deepPink"
                        onClick={() => {
                          setSelectedFantasyRow(entry); // Set the selected row when clicked
                        }}
                      >
                        <td className="relative flex items-center space-x-3 px-4">
                          <Image
                            src={entry.pfp || '/defifa_spinner.gif'}
                            alt="Home Team Logo"
                            className="rounded-full w-8 h-8 mr-8"
                            width={20}
                            height={20}
                          />
                          {entry.team.logo && entry.team.logo !== '/defifa_spinner.gif' && (
                            <Image
                              src={entry.team.logo}
                              alt="Team Logo"
                              className="rounded-full w-5 h-5 absolute top-0 left-10"
                              width={15}
                              height={15}
                              loading="lazy"
                            />
                          )}
                        </td>
                        <td>{entry.manager}</td>
                        <td className="text-center">{entry.rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>No fantasy data available.</div>
            )}
          </div>
        )}
  
        {selectedTab === "banter" && (
          <div>
            <h2 className="font-2xl text-notWhite font-bold mb-4">Bot</h2>
            <div className="bg-purplePanel p-4 rounded-md text-lightPurple">
              <p className="text-sm">Soon<sup className="text-sm">™</sup></p>
            </div>
          </div>
        )}
  
        {selectedTab === "players" && (
          <div>
            <h2 className="font-2xl text-notWhite font-bold mb-4">Collect</h2>
            <div className="bg-purplePanel p-4 rounded-md text-lightPurple">
              <p className="text-sm">Soon<sup className="text-sm">™</sup></p>
            </div>
          </div>
        )}

        {selectedTab === "falseNine" && (
          <div>
            {falseNineContent.length > 0 ? (
              <div key={0} className="mb-4">
                <h3 className="font-bold text-xl">{falseNineContent[0].title}</h3>
                <p className="text-sm text-gray-500">{falseNineContent[0].pubDate}</p>
                <p className="text-sm text-gray-500">Author: {falseNineContent[0].author}</p> {/* Display author */}
                {falseNineContent[0].image && (
                  <Image
                    src={falseNineContent[0].image}
                    alt="Post Image"
                    className="mt-2"
                    layout="responsive"
                    width={500}  // Set width as the base reference
                    height={300} // Set height as the corresponding aspect ratio
                  />
                )}
                <a
                  href={`${falseNineContent[0].link}?referrer=0x8b80755C441d355405CA7571443Bb9247B77Ec16`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fontRed hover:underline"
                >
                  Subscribe to The False Nine
                </a>
                <button 
                  className='text-notWhite ml-2' 
                  onClick={readMatchSummary}>
                  🗣️🎧1.5x
                </button>
                <div
                  className="text-lightPurple bg-purplePanel mt-2 space-y-2"
                  dangerouslySetInnerHTML={{
                    __html: falseNineContent[0].content,
                  }}
                />
                <a
                  href={`${falseNineContent[0].link}?referrer=0x8b80755C441d355405CA7571443Bb9247B77Ec16`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fontRed hover:underline"
                >
                  Subscribe to The False Nine
                </a>
              </div>
              
            ) : (
              <div>No content available for The False Nine.</div>
            )}
            {loadingTFN && <div>Loading content...</div>}
            {errorTFN && <div className="text-red-500">{errorTFN}</div>}
          </div>
        )}
      </div>
    </div>
  );
  
}
