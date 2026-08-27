function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}


async function supabaseGet(env, path) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/${path}`,
    {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization:
          `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        accept: "application/json",
      },
    }
  );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${text}`
    );
  }

  return text
    ? JSON.parse(text)
    : [];
}


export async function onRequestGet({
  request,
  env,
}) {
  try {

    if (
      !env.SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(
        {
          success: false,
          error:
            "Missing server configuration.",
        },
        500
      );
    }


    const url =
      new URL(request.url);


    const playerKey =
      String(
        url.searchParams.get(
          "player"
        ) || ""
      ).trim();


    if (!playerKey) {
      return json(
        {
          success: false,
          error:
            "A player is required.",
        },
        400
      );
    }


    /*
      STEP 1
      FIND BOCA RATON BILLYGOATS TEAM
    */

    const teams =
      await supabaseGet(
        env,
        "teams" +
        "?team_key=eq.boca-billygoats-cooperstown" +
        "&select=id,team_key,team_name" +
        "&limit=1"
      );


    if (!teams.length) {
      return json(
        {
          success: false,
          error:
            "Boca Raton Billygoats team not found.",
        },
        404
      );
    }


    const team =
      teams[0];


    /*
      STEP 2
      FIND PLAYER
    */

    const players =
      await supabaseGet(
        env,
        "players" +
        `?team_id=eq.${encodeURIComponent(
          team.id
        )}` +
        `&player_key=eq.${encodeURIComponent(
          playerKey
        )}` +
        "&select=id,team_id,player_key,player_name,player_number" +
        "&limit=1"
      );


    if (!players.length) {
      return json(
        {
          success: false,
          error:
            "Player not found.",
        },
        404
      );
    }


    const player =
      players[0];


    /*
      STEP 3
      LOAD ALL 100 BASEBALLS
    */

    const baseballs =
      await supabaseGet(
        env,
        "baseballs" +
        `?player_id=eq.${encodeURIComponent(
          player.id
        )}` +
        "&select=ball_number,amount_cents,status,donor_name,sold_at,stripe_session_id" +
        "&order=ball_number.asc"
      );


    /*
      STEP 4
      CALCULATE PLAYER TOTALS
    */

    const soldBaseballs =
      baseballs.filter(
        ball =>
          ball.status ===
          "sold"
      );


    const raisedCents =
      soldBaseballs.reduce(
        (
          sum,
          ball
        ) => {

          const amount =
            Number(
              ball.amount_cents
            ) ||
            (
              Number(
                ball.ball_number
              ) *
              100
            );


          return sum +
            amount;

        },
        0
      );


    return json({
      success: true,

      team: {
        id:
          team.id,

        teamKey:
          team.team_key,

        teamName:
          team.team_name,
      },

      player: {
        id:
          player.id,

        playerKey:
          player.player_key,

        playerName:
          player.player_name,

        playerNumber:
          player.player_number,
      },

      baseballs,

      totals: {
        soldCount:
          soldBaseballs.length,

        raisedCents,

        goalCents:
          505000,
      },
    });


  } catch (error) {

    console.error(
      "Fundraiser API error:",
      error
    );


    return json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
}
